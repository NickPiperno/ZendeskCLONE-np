-- Drop existing functions
DROP FUNCTION IF EXISTS public.find_best_agent_match(UUID);
DROP FUNCTION IF EXISTS public.get_all_user_skills();

-- Add deleted column to team_schedules if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'team_schedules' 
        AND column_name = 'deleted'
    ) THEN
        ALTER TABLE public.team_schedules ADD COLUMN deleted boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- Create function to soft delete team schedules
CREATE OR REPLACE FUNCTION public.soft_delete_team_schedule(schedule_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.team_schedules
    SET deleted = true,
        updated_at = NOW()
    WHERE id = schedule_id;
END;
$$;

-- Create function to get all user skills
CREATE OR REPLACE FUNCTION public.get_all_user_skills()
RETURNS TABLE (
    user_skills jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jsonb_build_object(
            'id', us.id,
            'user_id', us.user_id,
            'skill_id', us.skill_id,
            'proficiency_level', us.proficiency_level,
            'user_name', p.full_name,
            'user_email', p.email
        ) as user_skills
    FROM user_skills us
    JOIN profiles p ON p.id = us.user_id
    WHERE p.role = 'agent';
END;
$$;

-- Recreate function with logging
CREATE OR REPLACE FUNCTION public.find_best_agent_match(p_ticket_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_priority text;
    v_current_time time;
    v_current_day integer;
    v_best_agent jsonb;
    v_available_agents jsonb;
    v_required_skills jsonb;
BEGIN
    -- Get required skills first
    SELECT jsonb_agg(
        jsonb_build_object(
            'skill_id', ts.skill_id,
            'required_proficiency', ts.required_proficiency
        )
    )
    INTO v_required_skills
    FROM ticket_skills ts
    WHERE ts.ticket_id = p_ticket_id;

    -- Log required skills
    RAISE NOTICE 'Required skills: %', v_required_skills;

    -- Get current time and day
    SELECT CURRENT_TIME INTO v_current_time;
    SELECT EXTRACT(DOW FROM CURRENT_DATE) INTO v_current_day;

    -- Log schedule debug info
    RAISE NOTICE 'Current time: %, Current day: %', v_current_time, v_current_day;
    
    -- Check schedule availability
    WITH schedule_check AS (
        SELECT 
            ts.user_id,
            ts.day_of_week,
            ts.start_time,
            ts.end_time,
            ts.is_active,
            v_current_time BETWEEN ts.start_time AND ts.end_time as is_within_hours
        FROM team_schedules ts
        WHERE ts.day_of_week = v_current_day
    )
    SELECT jsonb_agg(to_jsonb(s)) INTO v_available_agents
    FROM schedule_check s;
    
    RAISE NOTICE 'Schedule check results: %', v_available_agents;

    -- Get available agents and their skills
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'email', p.email,
            'skills', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', us.id,
                        'skill_id', us.skill_id,
                        'proficiency_level', us.proficiency_level
                    )
                )
                FROM user_skills us
                WHERE us.user_id = p.id
            ),
            'schedule', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'day_of_week', ts.day_of_week,
                        'start_time', ts.start_time,
                        'end_time', ts.end_time,
                        'is_active', ts.is_active
                    )
                )
                FROM team_schedules ts
                WHERE ts.user_id = p.id
                    AND ts.day_of_week = v_current_day
            )
        )
    )
    INTO v_available_agents
    FROM profiles p
    WHERE p.role = 'agent';

    -- Log available agents
    RAISE NOTICE 'Available agents and their skills: %', v_available_agents;

    -- Get ticket priority
    SELECT priority INTO v_ticket_priority
    FROM tickets
    WHERE id = p_ticket_id AND deleted = false;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'agent_id', NULL,
            'match_score', 0,
            'reason', 'Ticket not found'
        );
    END IF;

    WITH required_skills AS (
        SELECT 
            ts.skill_id,
            ts.required_proficiency
        FROM 
            ticket_skills ts
        WHERE 
            ts.ticket_id = p_ticket_id
    ),
    available_agents AS (
        SELECT 
            p.id as agent_id,
            p.full_name,
            p.email,
            COUNT(DISTINCT t.id) as active_tickets
        FROM 
            profiles p
            LEFT JOIN tickets t ON t.assigned_to = p.id 
                AND t.status NOT IN ('resolved', 'closed')
                AND t.deleted = false
        WHERE 
            p.role = 'agent'
            AND EXISTS (
                SELECT 1 
                FROM team_schedules ts 
                WHERE ts.user_id = p.id 
                    AND ts.day_of_week = v_current_day
                    AND ts.is_active = true
                    AND ts.deleted = false
                    AND v_current_time BETWEEN ts.start_time AND (
                        SELECT MAX(end_time)
                        FROM team_schedules ts2
                        WHERE ts2.user_id = p.id
                            AND ts2.day_of_week = v_current_day
                            AND ts2.is_active = true
                            AND ts2.deleted = false
                    )
            )
        GROUP BY 
            p.id, p.full_name, p.email
    ),
    agent_skill_scores AS (
        SELECT 
            aa.agent_id,
            aa.full_name,
            aa.email,
            CASE 
                WHEN COUNT(rs.*) = 0 THEN 0  -- No skills required
                WHEN COUNT(DISTINCT CASE WHEN us.proficiency_level >= rs.required_proficiency THEN rs.skill_id END) = COUNT(DISTINCT rs.skill_id) 
                THEN 1  -- All required skills match
                ELSE 0  -- Not all skills match
            END as skill_score,
            string_agg(
                CASE 
                    WHEN us.proficiency_level >= rs.required_proficiency 
                    THEN 'Has skill ' || rs.skill_id || ' at level ' || us.proficiency_level
                    ELSE 'Missing skill ' || rs.skill_id || ' or insufficient level'
                END,
                ', '
            ) as skill_details
        FROM 
            available_agents aa
            CROSS JOIN required_skills rs
            LEFT JOIN user_skills us ON us.user_id = aa.agent_id 
                AND us.skill_id = rs.skill_id
        GROUP BY 
            aa.agent_id, aa.full_name, aa.email
    ),
    agent_workload_scores AS (
        SELECT 
            aa.agent_id,
            aa.full_name,
            CASE 
                WHEN aa.active_tickets = 0 THEN 1
                ELSE 1.0 / aa.active_tickets
            END as workload_score,
            aa.active_tickets
        FROM 
            available_agents aa
    ),
    final_scores AS (
        SELECT 
            ass.agent_id,
            ass.full_name,
            ass.email,
            ass.skill_score,
            aws.workload_score,
            aws.active_tickets,
            ass.skill_details,
            (ass.skill_score * 0.7 + aws.workload_score * 0.3) as final_score
        FROM 
            agent_skill_scores ass
            JOIN agent_workload_scores aws ON aws.agent_id = ass.agent_id
        WHERE 
            ass.skill_score > 0  -- Only consider agents with matching skills
    )
    SELECT 
        jsonb_build_object(
            'agent_id', agent_id,
            'match_score', final_score,
            'reason', CASE 
                WHEN agent_id IS NULL THEN 
                    CASE 
                        WHEN NOT EXISTS (SELECT 1 FROM available_agents) THEN 'No agents available during current schedule'
                        WHEN NOT EXISTS (SELECT 1 FROM required_skills) THEN 'No required skills specified for ticket'
                        ELSE 'No agents with required skills found'
                    END
                ELSE skill_details || ', Workload: ' || active_tickets || ' active tickets'
            END
        )
    INTO v_best_agent
    FROM final_scores
    ORDER BY final_score DESC
    LIMIT 1;

    -- If no match found, return null with reason
    IF v_best_agent IS NULL THEN
        RETURN jsonb_build_object(
            'agent_id', NULL,
            'match_score', 0,
            'reason', CASE 
                WHEN v_required_skills IS NULL THEN 'No required skills specified for ticket'
                WHEN v_available_agents IS NULL THEN 'No agents available'
                ELSE 'No agents match required skills'
            END
        );
    END IF;

    RETURN v_best_agent;
END;
$$;

-- Grant execute permissions
REVOKE EXECUTE ON FUNCTION public.find_best_agent_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_best_agent_match(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_all_user_skills() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_user_skills() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_team_schedule(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_team_schedule(UUID) TO authenticated; 