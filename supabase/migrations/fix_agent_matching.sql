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
    id UUID,
    user_id UUID,
    skill_id UUID,
    proficiency_level integer,
    user_name text,
    user_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.id,
        us.user_id,
        us.skill_id,
        us.proficiency_level,
        p.full_name as user_name,
        p.email as user_email
    FROM user_skills us
    JOIN profiles p ON p.id = us.user_id
    WHERE p.role = 'agent';
END;
$$;

-- Drop and recreate find_best_agent_match
DROP FUNCTION IF EXISTS public.find_best_agent_match(UUID);

CREATE OR REPLACE FUNCTION public.find_best_agent_match(p_ticket_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
    v_current_time time;
    v_current_day integer;
    v_best_agent_id UUID;
    v_schedule_count integer;
    v_ticket_exists boolean;
    v_schedule record;
    v_current_timestamp timestamp;
BEGIN
    -- Verify ticket exists and log its details
    SELECT EXISTS (
        SELECT 1 FROM tickets WHERE id = p_ticket_id AND deleted = false
    ) INTO v_ticket_exists;
    
    IF NOT v_ticket_exists THEN
        RAISE NOTICE 'Ticket not found or deleted: %', p_ticket_id;
        RETURN NULL;
    END IF;

    -- Get and log timezone information
    RAISE NOTICE 'Database timezone: %', current_setting('TIMEZONE');
    RAISE NOTICE 'Session timezone: %', current_setting('timezone');
    
    -- Get current time and day in EST (America/New_York)
    SELECT CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York' INTO v_current_timestamp;
    SELECT CURRENT_TIME AT TIME ZONE 'America/New_York' INTO v_current_time;
    -- Get day of week (1-7, where 1 is Monday) in EST
    SELECT EXTRACT(DOW FROM v_current_timestamp)::integer INTO v_current_day;
    -- Convert Sunday (0) to 7 to match the schedule format
    IF v_current_day = 0 THEN
        v_current_day := 7;
    END IF;
    
    RAISE NOTICE 'Current EST time: %, day: %', v_current_time, v_current_day;
    RAISE NOTICE 'Day mapping: 1=Monday, 2=Tuesday, ..., 7=Sunday';

    -- Log available schedules for debugging
    SELECT COUNT(*) INTO v_schedule_count
    FROM team_schedules ts
    WHERE ts.day_of_week = v_current_day
        AND ts.is_active = true
        AND ts.deleted = false
        AND v_current_time BETWEEN ts.start_time AND ts.end_time;
    
    RAISE NOTICE 'Number of active schedules for current time: %', v_schedule_count;
    
    -- Log all schedules regardless of day
    RAISE NOTICE 'All schedules in system:';
    FOR v_schedule IN (
        SELECT 
            user_id, 
            day_of_week,
            start_time, 
            end_time, 
            is_active, 
            deleted,
            CASE day_of_week
                WHEN 1 THEN 'Monday'
                WHEN 2 THEN 'Tuesday'
                WHEN 3 THEN 'Wednesday'
                WHEN 4 THEN 'Thursday'
                WHEN 5 THEN 'Friday'
                WHEN 6 THEN 'Saturday'
                WHEN 7 THEN 'Sunday'
            END as day_name
        FROM team_schedules
        ORDER BY day_of_week, start_time
    ) LOOP
        RAISE NOTICE 'User: %, Day: % (%), Time: % to %, Active: %, Deleted: %', 
            v_schedule.user_id, 
            v_schedule.day_of_week,
            v_schedule.day_name,
            v_schedule.start_time, 
            v_schedule.end_time, 
            v_schedule.is_active, 
            v_schedule.deleted;
    END LOOP;

    -- Find best agent with all conditions in a single query
    SELECT 
        p.id INTO v_best_agent_id
    FROM 
        profiles p
        -- Join with user skills and match against ticket skills
        JOIN user_skills us ON us.user_id = p.id
        JOIN ticket_skills ts ON ts.skill_id = us.skill_id 
            AND ts.ticket_id = p_ticket_id
        -- Check schedule
        JOIN team_schedules sch ON sch.user_id = p.id
            AND sch.day_of_week = v_current_day
            AND sch.is_active = true
            AND sch.deleted = false
            AND v_current_time BETWEEN sch.start_time AND sch.end_time
    WHERE 
        p.role = 'agent'
    GROUP BY 
        p.id
    HAVING 
        -- Must have all required skills
        COUNT(DISTINCT ts.skill_id) = (
            SELECT COUNT(DISTINCT skill_id) 
            FROM ticket_skills 
            WHERE ticket_id = p_ticket_id
        )
    ORDER BY
        -- Order by total proficiency (higher is better)
        SUM(us.proficiency_level) DESC,
        -- Then by workload (lower is better)
        (
            SELECT COUNT(*)
            FROM tickets t
            WHERE t.assigned_to = p.id
                AND t.status NOT IN ('resolved', 'closed')
                AND t.deleted = false
        ) ASC
    LIMIT 1;

    -- Log the result with detailed schedule information
    IF v_best_agent_id IS NOT NULL THEN
        RAISE NOTICE 'Found matching agent: %', v_best_agent_id;
        -- Log the agent's schedule
        RAISE NOTICE 'Agent schedule for today (Day %):',  v_current_day;
        FOR v_schedule IN (
            SELECT start_time, end_time, day_of_week
            FROM team_schedules
            WHERE user_id = v_best_agent_id
                AND day_of_week = v_current_day
                AND is_active = true
                AND deleted = false
        ) LOOP
            RAISE NOTICE 'Schedule: Day %, % to %', 
                v_schedule.day_of_week, v_schedule.start_time, v_schedule.end_time;
        END LOOP;
    ELSE
        RAISE NOTICE 'No matching agent found for day: %', v_current_day;
    END IF;

    RETURN v_best_agent_id;
END;
$$;

-- Set permissions
REVOKE EXECUTE ON FUNCTION public.find_best_agent_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_best_agent_match(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_all_user_skills() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_user_skills() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_team_schedule(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_team_schedule(UUID) TO authenticated; 