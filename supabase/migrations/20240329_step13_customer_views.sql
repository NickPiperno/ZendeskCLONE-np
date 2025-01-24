-- Create customer ticket view
CREATE OR REPLACE VIEW public.customer_tickets AS
SELECT 
    t.id,
    t.created_at,
    t.updated_at,
    t.title,
    t.description,
    t.status,
    t.priority,
    CASE 
        WHEN t.assigned_to IS NOT NULL THEN true
        ELSE false
    END as has_agent,
    t.user_id
FROM public.tickets t
WHERE NOT t.deleted;

-- Create customer ticket notes view
CREATE OR REPLACE VIEW public.customer_ticket_notes AS
SELECT 
    tn.id,
    tn.created_at,
    tn.ticket_id,
    tn.content,
    p.full_name as created_by_name,
    CASE 
        WHEN p.role = 'agent' THEN 'Support Agent'
        WHEN p.role = 'admin' THEN 'Support Admin'
        ELSE 'Customer'
    END as author_type
FROM public.ticket_notes tn
JOIN public.profiles p ON p.id = tn.created_by
WHERE NOT tn.deleted AND NOT tn.is_internal;

-- Create function to get customer ticket summary
CREATE OR REPLACE FUNCTION public.get_customer_ticket_summary(p_user_id UUID)
RETURNS TABLE (
    status TEXT,
    count BIGINT,
    last_update TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.status::TEXT,
        COUNT(*)::BIGINT,
        MAX(t.updated_at) as last_update
    FROM public.tickets t
    WHERE t.user_id = p_user_id
    AND NOT t.deleted
    GROUP BY t.status;
END;
$$;

-- Create function to get customer ticket timeline
CREATE OR REPLACE FUNCTION public.get_customer_ticket_timeline(p_ticket_id UUID)
RETURNS TABLE (
    event_time TIMESTAMPTZ,
    event_type TEXT,
    event_description TEXT,
    actor_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the user owns the ticket
    IF NOT EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = p_ticket_id
        AND t.user_id = auth.uid()
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT * FROM (
        -- Status changes from audit log
        SELECT 
            a.created_at as event_time,
            'status_change' as event_type,
            CASE
                WHEN (a.new_data->>'status') IS NOT NULL 
                THEN format('Ticket status changed to %s', a.new_data->>'status')
                ELSE 'Ticket status updated'
            END as event_description,
            p.full_name as actor_name
        FROM public.audit_logs a
        JOIN public.profiles p ON p.id = a.user_id
        WHERE a.table_name = 'tickets'
        AND a.record_id = p_ticket_id
        AND (a.new_data->>'status') IS DISTINCT FROM (a.old_data->>'status')

        UNION ALL

        -- Notes added
        SELECT 
            n.created_at as event_time,
            'note_added' as event_type,
            'New note added' as event_description,
            p.full_name as actor_name
        FROM public.ticket_notes n
        JOIN public.profiles p ON p.id = n.created_by
        WHERE n.ticket_id = p_ticket_id
        AND NOT n.is_internal
        AND NOT n.deleted

        UNION ALL

        -- Assignment changes
        SELECT 
            a.created_at as event_time,
            'assignment_change' as event_type,
            CASE
                WHEN a.new_data->>'assigned_to' IS NULL THEN 'Ticket unassigned'
                ELSE 'Ticket assigned to agent'
            END as event_description,
            p.full_name as actor_name
        FROM public.audit_logs a
        JOIN public.profiles p ON p.id = a.user_id
        WHERE a.table_name = 'tickets'
        AND a.record_id = p_ticket_id
        AND (a.new_data->>'assigned_to') IS DISTINCT FROM (a.old_data->>'assigned_to')
    ) events
    ORDER BY event_time DESC;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.customer_tickets TO authenticated;
GRANT SELECT ON public.customer_ticket_notes TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_ticket_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_ticket_timeline TO authenticated;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can update their own tickets" ON public.tickets;

-- Create policies for user ticket access
CREATE POLICY "Users can view their own tickets"
    ON public.tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'user'
            AND auth.uid() = tickets.user_id
        )
    );

CREATE POLICY "Users can create tickets"
    ON public.tickets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'user'
        )
        AND auth.uid() = user_id
    );

CREATE POLICY "Users can update their own tickets"
    ON public.tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'user'
            AND auth.uid() = tickets.user_id
        )
    ); 