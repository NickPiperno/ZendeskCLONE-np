-- Drop triggers first
DROP TRIGGER IF EXISTS ticket_skills_auto_assign_trigger ON public.ticket_skills;
DROP TRIGGER IF EXISTS ticket_auto_assign_trigger ON public.tickets;

-- Then drop functions
DROP FUNCTION IF EXISTS public.try_reassign_on_skills_change();
DROP FUNCTION IF EXISTS public.try_auto_assign_ticket();
DROP FUNCTION IF EXISTS public.auto_assign_ticket(UUID);
DROP FUNCTION IF EXISTS public.find_best_agent_match(UUID);

-- Now create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ticket_skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ticket_id UUID REFERENCES public.tickets(id),
    skill_id UUID REFERENCES public.skills(id),
    required_proficiency INTEGER CHECK (required_proficiency BETWEEN 1 AND 5),
    UNIQUE(ticket_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.ticket_skills ENABLE ROW LEVEL SECURITY;

-- Policies for ticket_skills
CREATE POLICY "Everyone can view ticket skills"
    ON public.ticket_skills FOR SELECT
    USING (true);

CREATE POLICY "Users can add skills to their tickets"
    ON public.ticket_skills FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = ticket_skills.ticket_id AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins and agents can manage ticket skills"
    ON public.ticket_skills FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'agent')
        )
    );

-- Grant permissions
GRANT ALL ON public.ticket_skills TO authenticated;

-- Function to find best agent match for a ticket
CREATE OR REPLACE FUNCTION public.find_best_agent_match(p_ticket_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    ticket_priority ticket_priority;
    current_time TIME;
    current_day INTEGER;
    v_log_message TEXT;
    best_agent_id UUID;
BEGIN
    -- Get ticket priority
    SELECT t.priority INTO ticket_priority
    FROM tickets t
    WHERE t.id = p_ticket_id;
    
    RAISE NOTICE 'Starting agent match for ticket % (Priority: %)', p_ticket_id, ticket_priority;

    -- Get current time for schedule checking
    SELECT CURRENT_TIME INTO current_time;
    SELECT EXTRACT(ISODOW FROM CURRENT_DATE) INTO current_day;
    
    RAISE NOTICE 'Current time: %, day: %', current_time, current_day;

    -- Log required skills
    WITH required_skills_log AS (
        SELECT 
            array_agg(s.name) as skill_names,
            array_agg(ts.required_proficiency) as proficiency_levels
        FROM ticket_skills ts
        JOIN skills s ON s.id = ts.skill_id
        WHERE ts.ticket_id = p_ticket_id
    )
    SELECT format('Required skills: %s (proficiency: %s)', 
           skill_names, proficiency_levels)
    INTO v_log_message
    FROM required_skills_log;
    RAISE NOTICE '%', v_log_message;

    -- Find best agent match
    WITH required_skills AS (
        SELECT skill_id, required_proficiency
        FROM ticket_skills
        WHERE ticket_id = p_ticket_id
    ),
    available_agents AS (
        SELECT DISTINCT p.id as agent_id
        FROM profiles p
        JOIN team_members tm ON tm.user_id = p.id
        JOIN team_schedules ts ON ts.user_id = p.id
        WHERE 
            p.role = 'agent'
            AND p.is_active = true
            AND ts.day_of_week = current_day
            AND current_time BETWEEN ts.start_time AND ts.end_time
    ),
    skill_scores AS (
        SELECT 
            aa.agent_id,
            COALESCE(
                AVG(
                    CASE 
                        WHEN us.proficiency_level >= rs.required_proficiency THEN 100
                        ELSE (us.proficiency_level::NUMERIC / rs.required_proficiency::NUMERIC) * 100
                    END
                ),
                0
            ) as skill_score
        FROM available_agents aa
        CROSS JOIN required_skills rs
        LEFT JOIN user_skills us ON 
            us.user_id = aa.agent_id AND 
            us.skill_id = rs.skill_id
        GROUP BY aa.agent_id
    ),
    workload_scores AS (
        SELECT 
            aa.agent_id,
            CASE 
                WHEN COUNT(t.id) = 0 THEN 100
                ELSE GREATEST(0, 100 - (COUNT(t.id) * 10))
            END as workload_score
        FROM available_agents aa
        LEFT JOIN tickets t ON 
            t.assigned_to = aa.agent_id AND 
            t.status IN ('open', 'in_progress')
        GROUP BY aa.agent_id
    )
    SELECT agent_id INTO best_agent_id
    FROM (
        SELECT 
            aa.agent_id,
            (ss.skill_score * 0.6 + ws.workload_score * 0.4) as final_score
        FROM available_agents aa
        JOIN skill_scores ss ON ss.agent_id = aa.agent_id
        JOIN workload_scores ws ON ws.agent_id = aa.agent_id
        WHERE 
            ss.skill_score >= 60
            AND ws.workload_score >= 50
        ORDER BY final_score DESC
        LIMIT 1
    ) final_scores;

    -- Log the result
    IF best_agent_id IS NULL THEN
        WITH agent_stats AS (
            SELECT 
                COUNT(*) FILTER (WHERE role = 'agent') as total_agents,
                COUNT(*) FILTER (WHERE role = 'agent' AND is_active = true) as active_agents,
                COUNT(*) FILTER (
                    WHERE role = 'agent' 
                    AND is_active = true 
                    AND EXISTS (
                        SELECT 1 
                        FROM team_schedules ts 
                        WHERE ts.user_id = profiles.id
                        AND ts.day_of_week = current_day
                        AND current_time BETWEEN ts.start_time AND ts.end_time
                    )
                ) as scheduled_agents,
                COUNT(*) FILTER (
                    WHERE role = 'agent' 
                    AND is_active = true 
                    AND EXISTS (
                        SELECT 1 
                        FROM user_skills us
                        JOIN ticket_skills ts ON ts.skill_id = us.skill_id
                        WHERE us.user_id = profiles.id
                        AND ts.ticket_id = p_ticket_id
                    )
                ) as agents_with_skills
            FROM profiles
        )
        SELECT format(
            'No match found. Stats: Total agents: %s, Active: %s, Scheduled: %s, With skills: %s',
            total_agents, active_agents, scheduled_agents, agents_with_skills
        )
        INTO v_log_message
        FROM agent_stats;
        
        RAISE NOTICE '%', v_log_message;
    ELSE
        RAISE NOTICE 'Found matching agent: %', best_agent_id;
    END IF;

    RETURN best_agent_id;
END;
$$;

-- Function to auto-assign ticket
CREATE OR REPLACE FUNCTION public.auto_assign_ticket(p_ticket_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_agent_id UUID;
BEGIN
    -- Find the best agent match
    SELECT public.find_best_agent_match(p_ticket_id) INTO v_agent_id;
    
    IF v_agent_id IS NOT NULL THEN
        UPDATE tickets 
        SET 
            assigned_to = v_agent_id,
            updated_at = NOW()
        WHERE id = p_ticket_id;
        
        RAISE NOTICE 'Ticket % assigned to agent %', p_ticket_id, v_agent_id;
    ELSE
        RAISE NOTICE 'No suitable agent found for ticket %', p_ticket_id;
    END IF;

    RETURN v_agent_id;
END;
$$;

-- Create trigger function for auto-assignment
CREATE OR REPLACE FUNCTION public.try_auto_assign_ticket()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only try to assign if ticket is new or unassigned
    IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS NULL) THEN
        -- Attempt to assign the ticket
        PERFORM public.auto_assign_ticket(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger for new tickets
CREATE TRIGGER ticket_auto_assign_trigger
    AFTER INSERT OR UPDATE OF status, priority
    ON public.tickets
    FOR EACH ROW
    WHEN (NEW.assigned_to IS NULL)
    EXECUTE FUNCTION public.try_auto_assign_ticket();

-- Create trigger function for skill updates
CREATE OR REPLACE FUNCTION public.try_reassign_on_skills_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    ticket_record tickets%ROWTYPE;
BEGIN
    -- Get the ticket
    SELECT t.* INTO ticket_record
    FROM public.tickets t
    WHERE t.id = NEW.ticket_id;

    -- Only try to reassign if ticket exists and is unassigned
    IF FOUND AND ticket_record.assigned_to IS NULL THEN
        -- Attempt to assign the ticket
        PERFORM public.auto_assign_ticket(NEW.ticket_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger for ticket skill changes
CREATE TRIGGER ticket_skills_auto_assign_trigger
    AFTER INSERT OR UPDATE
    ON public.ticket_skills
    FOR EACH ROW
    EXECUTE FUNCTION public.try_reassign_on_skills_change();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.find_best_agent_match(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_assign_ticket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_auto_assign_ticket() TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_reassign_on_skills_change() TO authenticated; 