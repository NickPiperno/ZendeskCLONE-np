-- Drop existing objects first
DROP TRIGGER IF EXISTS ticket_skills_auto_assign_trigger ON public.ticket_skills;
DROP TRIGGER IF EXISTS ticket_auto_assign_trigger ON public.tickets;
DROP FUNCTION IF EXISTS public.try_reassign_on_skills_change();
DROP FUNCTION IF EXISTS public.try_auto_assign_ticket();
DROP FUNCTION IF EXISTS public.auto_assign_ticket(UUID);
DROP FUNCTION IF EXISTS public.find_best_agent_match(UUID);
DROP TABLE IF EXISTS public.ticket_skills;

-- Add ticket_skills junction table
CREATE TABLE public.ticket_skills (
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
RETURNS TABLE (
    agent_id UUID,
    match_score NUMERIC,
    reason TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    ticket_priority ticket_priority;
    current_time TIME;
    current_day INTEGER;
BEGIN
    -- Get ticket priority
    SELECT t.priority INTO ticket_priority
    FROM tickets t
    WHERE t.id = p_ticket_id;

    -- Get current time for schedule checking
    SELECT CURRENT_TIME INTO current_time;
    -- Get current day (1-7, Monday = 1)
    SELECT EXTRACT(ISODOW FROM CURRENT_DATE) INTO current_day;

    RETURN QUERY
    WITH required_skills AS (
        -- Get required skills for the ticket
        SELECT 
            ts.skill_id,
            ts.required_proficiency
        FROM ticket_skills ts
        WHERE ts.ticket_id = p_ticket_id
    ),
    available_agents AS (
        -- Get agents who are:
        -- 1. Active
        -- 2. Currently scheduled to work
        -- 3. Have the required skills
        SELECT DISTINCT
            p.id as agent_id,
            -- Base score starts at 100
            100::NUMERIC as base_score
        FROM profiles p
        JOIN team_members tm ON tm.user_id = p.id
        JOIN team_schedules ts ON ts.user_id = p.id
        WHERE 
            p.role = 'agent'
            AND p.is_active = true
            -- Check if agent is scheduled to work now
            AND ts.day_of_week = current_day
            AND current_time BETWEEN ts.start_time AND ts.end_time
    ),
    skill_scores AS (
        -- Calculate skill match scores
        SELECT 
            aa.agent_id,
            COALESCE(
                AVG(
                    CASE 
                        -- Perfect match or higher proficiency = 100%
                        WHEN us.proficiency_level >= rs.required_proficiency THEN 100
                        -- Partial match = percentage of required proficiency
                        ELSE (us.proficiency_level::NUMERIC / rs.required_proficiency::NUMERIC) * 100
                    END
                ),
                0  -- No skills = 0 score
            ) as skill_score
        FROM available_agents aa
        LEFT JOIN required_skills rs ON true  -- Cross join with required skills
        LEFT JOIN user_skills us ON us.user_id = aa.agent_id AND us.skill_id = rs.skill_id
        GROUP BY aa.agent_id
    ),
    workload_scores AS (
        -- Calculate workload scores (inverse - lower is better)
        SELECT 
            aa.agent_id,
            CASE 
                WHEN COUNT(t.id) = 0 THEN 100  -- No tickets = perfect score
                ELSE 100 - (COUNT(t.id) * 10)  -- -10 points per active ticket
            END as workload_score
        FROM available_agents aa
        LEFT JOIN tickets t ON t.assigned_to = aa.agent_id 
            AND t.status IN ('open', 'in_progress')
        GROUP BY aa.agent_id
    )
    -- Combine all scores with priority weighting
    SELECT 
        aa.agent_id,
        (
            -- Skill score weighted at 50%
            (ss.skill_score * 0.5) +
            -- Workload score weighted at 30-50% based on priority
            (ws.workload_score * 
                CASE ticket_priority
                    WHEN 'urgent' THEN 0.3  -- For urgent tickets, prioritize skills over workload
                    WHEN 'high' THEN 0.35
                    WHEN 'medium' THEN 0.4
                    WHEN 'low' THEN 0.5     -- For low priority, distribute more evenly
                END
            )
        ) as match_score,
        CASE 
            WHEN ss.skill_score < 60 THEN 'Low skill match'
            WHEN ws.workload_score < 60 THEN 'High current workload'
            ELSE 'Good match'
        END as reason
    FROM available_agents aa
    JOIN skill_scores ss ON ss.agent_id = aa.agent_id
    JOIN workload_scores ws ON ws.agent_id = aa.agent_id
    WHERE 
        -- Ensure minimum skill score of 60%
        ss.skill_score >= 60
        -- Ensure agent has capacity (no more than 5 active tickets)
        AND ws.workload_score >= 50
    ORDER BY match_score DESC;
END;
$$;

-- Function to automatically assign ticket to best matching agent
CREATE OR REPLACE FUNCTION public.auto_assign_ticket(p_ticket_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    selected_agent_id UUID;
BEGIN
    -- Find best matching agent
    SELECT agent_id INTO selected_agent_id
    FROM public.find_best_agent_match(p_ticket_id)
    LIMIT 1;

    -- If an agent was found, assign the ticket
    IF selected_agent_id IS NOT NULL THEN
        UPDATE public.tickets t
        SET 
            assigned_to = selected_agent_id,
            status = 'in_progress',
            updated_at = NOW()
        WHERE t.id = p_ticket_id;
    END IF;

    RETURN selected_agent_id;
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