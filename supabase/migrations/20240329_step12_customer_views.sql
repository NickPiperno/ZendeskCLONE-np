-- Drop existing views first
DROP VIEW IF EXISTS public.customer_tickets;
DROP VIEW IF EXISTS public.customer_ticket_notes;
DROP FUNCTION IF EXISTS public.get_customer_ticket_timeline(UUID);

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
CREATE OR REPLACE FUNCTION public.get_customer_ticket_summary(p_user_id UUID DEFAULT auth.uid())
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
    actor_name TEXT,
    metadata JSONB
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
        AND NOT t.deleted
    ) THEN
        -- Return empty result set instead of NULL
        RETURN QUERY SELECT 
            NULL::TIMESTAMPTZ,
            NULL::TEXT,
            NULL::TEXT,
            NULL::TEXT,
            NULL::JSONB
        WHERE false;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT * FROM (
        -- Ticket creation event (always included)
        SELECT 
            t.created_at as event_time,
            'ticket_created' as event_type,
            'Ticket created' as event_description,
            COALESCE(
                CASE 
                    WHEN p.role = 'agent' THEN 'Support Agent'
                    WHEN p.role = 'admin' THEN 'Support Admin'
                    ELSE p.full_name
                END,
                'System'
            ) as actor_name,
            jsonb_build_object(
                'ticket_id', t.id,
                'title', t.title
            ) as metadata
        FROM public.tickets t
        LEFT JOIN public.profiles p ON p.id = t.user_id
        WHERE t.id = p_ticket_id
        AND NOT t.deleted

        UNION ALL

        -- Initial description as a note if not empty
        SELECT 
            t.created_at as event_time,
            'note_added' as event_type,
            t.description as event_description,
            COALESCE(
                CASE 
                    WHEN p.role = 'agent' THEN 'Support Agent'
                    WHEN p.role = 'admin' THEN 'Support Admin'
                    ELSE p.full_name
                END,
                'System'
            ) as actor_name,
            jsonb_build_object(
                'ticket_id', t.id,
                'is_initial_description', true
            ) as metadata
        FROM public.tickets t
        LEFT JOIN public.profiles p ON p.id = t.user_id
        WHERE t.id = p_ticket_id
        AND NOT t.deleted
        AND t.description IS NOT NULL
        AND t.description != ''

        UNION ALL

        -- Status changes from audit log
        SELECT 
            a.created_at as event_time,
            'status_change' as event_type,
            CASE
                WHEN (a.new_data->>'status') IS NOT NULL 
                THEN format('Status changed to %s', 
                    CASE a.new_data->>'status'
                        WHEN 'open' THEN 'Open'
                        WHEN 'in_progress' THEN 'In Progress'
                        WHEN 'resolved' THEN 'Resolved'
                        WHEN 'closed' THEN 'Closed'
                        ELSE a.new_data->>'status'
                    END
                )
                ELSE 'Status updated'
            END as event_description,
            COALESCE(
                CASE 
                    WHEN p.role = 'agent' THEN 'Support Agent'
                    WHEN p.role = 'admin' THEN 'Support Admin'
                    ELSE p.full_name
                END,
                'System'
            ) as actor_name,
            jsonb_build_object(
                'old_status', a.old_data->>'status',
                'new_status', a.new_data->>'status'
            ) as metadata
        FROM public.audit_logs a
        LEFT JOIN public.profiles p ON p.id = a.user_id
        WHERE a.table_name = 'tickets'
        AND a.record_id = p_ticket_id
        AND (a.new_data->>'status') IS DISTINCT FROM (a.old_data->>'status')

        UNION ALL

        -- Public notes only
        SELECT 
            n.created_at as event_time,
            'note_added' as event_type,
            n.content as event_description,
            COALESCE(
                CASE 
                    WHEN p.role = 'agent' THEN 'Support Agent'
                    WHEN p.role = 'admin' THEN 'Support Admin'
                    ELSE p.full_name
                END,
                'System'
            ) as actor_name,
            jsonb_build_object(
                'note_id', n.id,
                'thread_id', n.thread_id
            ) as metadata
        FROM public.ticket_notes n
        LEFT JOIN public.profiles p ON p.id = n.created_by
        WHERE n.ticket_id = p_ticket_id
        AND NOT n.is_internal
        AND NOT n.deleted

        UNION ALL

        -- Assignment changes (simplified for customers)
        SELECT 
            a.created_at as event_time,
            'assignment_change' as event_type,
            CASE
                WHEN a.new_data->>'assigned_to' IS NULL THEN 'Ticket unassigned'
                ELSE 'Ticket assigned to support team'
            END as event_description,
            COALESCE(
                CASE 
                    WHEN p.role = 'agent' THEN 'Support Agent'
                    WHEN p.role = 'admin' THEN 'Support Admin'
                    ELSE p.full_name
                END,
                'System'
            ) as actor_name,
            jsonb_build_object(
                'assigned_to', a.new_data->>'assigned_to'
            ) as metadata
        FROM public.audit_logs a
        LEFT JOIN public.profiles p ON p.id = a.user_id
        WHERE a.table_name = 'tickets'
        AND a.record_id = p_ticket_id
        AND (a.new_data->>'assigned_to') IS DISTINCT FROM (a.old_data->>'assigned_to')
    ) events
    ORDER BY event_time DESC;
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can update their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can update any ticket" ON public.tickets;
DROP POLICY IF EXISTS "Admins can delete any ticket" ON public.tickets;

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Create user policies
CREATE POLICY "Users can view their own tickets"
    ON public.tickets FOR SELECT
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'user'
        )
    );

CREATE POLICY "Users can create tickets"
    ON public.tickets FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'user'
        )
    );

CREATE POLICY "Users can update their own tickets"
    ON public.tickets FOR UPDATE
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'user'
        )
    );

-- Create admin policies
CREATE POLICY "Admins can view all tickets"
    ON public.tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'agent')
        )
    );

CREATE POLICY "Admins can create tickets"
    ON public.tickets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'agent')
        )
    );

CREATE POLICY "Admins can update any ticket"
    ON public.tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'agent')
        )
    );

CREATE POLICY "Admins can delete any ticket"
    ON public.tickets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'agent')
        )
    );

-- Grant permissions
GRANT ALL ON public.tickets TO authenticated;

-- Grant permissions
GRANT SELECT ON public.customer_tickets TO authenticated;
GRANT SELECT ON public.customer_ticket_notes TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_ticket_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_ticket_timeline TO authenticated; 