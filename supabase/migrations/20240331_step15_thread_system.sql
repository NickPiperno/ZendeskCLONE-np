-- Create thread types enum if they don't exist
DO $$ BEGIN
    CREATE TYPE thread_type AS ENUM ('customer_initiated', 'agent_initiated', 'ai_initiated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE thread_status AS ENUM ('open', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('customer', 'agent', 'system', 'ai');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create timestamp trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create threads table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ticket_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES public.tickets(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT,
    status thread_status DEFAULT 'open' NOT NULL,
    thread_type thread_type NOT NULL,
    ai_context JSONB DEFAULT '{}'::jsonb,
    deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ
);

-- Add created_by column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'ticket_threads' AND column_name = 'created_by') THEN
        ALTER TABLE public.ticket_threads ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Add thread_id and message_type to ticket_notes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'ticket_notes' AND column_name = 'thread_id') THEN
        ALTER TABLE public.ticket_notes ADD COLUMN thread_id UUID REFERENCES public.ticket_threads(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'ticket_notes' AND column_name = 'message_type') THEN
        ALTER TABLE public.ticket_notes ADD COLUMN message_type message_type;
    END IF;
END $$;

-- Add metadata column to ticket_notes if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'ticket_notes' AND column_name = 'metadata') THEN
        ALTER TABLE public.ticket_notes ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create indexes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_threads_ticket_id') THEN
        CREATE INDEX idx_ticket_threads_ticket_id ON public.ticket_threads(ticket_id) WHERE NOT deleted;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_threads_status') THEN
        CREATE INDEX idx_ticket_threads_status ON public.ticket_threads(status) WHERE NOT deleted;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_threads_type') THEN
        CREATE INDEX idx_ticket_threads_type ON public.ticket_threads(thread_type) WHERE NOT deleted;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_notes_thread_id') THEN
        CREATE INDEX idx_ticket_notes_thread_id ON public.ticket_notes(thread_id) WHERE NOT deleted;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_notes_message_type') THEN
        CREATE INDEX idx_ticket_notes_message_type ON public.ticket_notes(message_type) WHERE NOT deleted;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_threads_ai_context') THEN
        CREATE INDEX idx_ticket_threads_ai_context ON public.ticket_threads USING gin (ai_context);
    END IF;
END $$;

-- Drop existing view first
DROP VIEW IF EXISTS public.customer_ticket_notes;

-- Recreate the view with new columns
CREATE VIEW public.customer_ticket_notes AS
SELECT 
    tn.id,
    tn.created_at,
    tn.ticket_id,
    tn.thread_id,
    tn.content,
    tn.message_type,
    p.full_name as created_by_name,
    CASE 
        WHEN p.role = 'agent' THEN 'Support Agent'
        WHEN p.role = 'admin' THEN 'Support Admin'
        ELSE 'Customer'
    END as author_type
FROM public.ticket_notes tn
JOIN public.profiles p ON p.id = tn.created_by
WHERE NOT tn.deleted AND NOT tn.is_internal;

-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_customer_ticket_timeline;

-- Recreate the function with ticket creation event
CREATE OR REPLACE FUNCTION public.get_customer_ticket_timeline(p_ticket_id UUID)
RETURNS TABLE (
    event_time TIMESTAMPTZ,
    event_type TEXT,
    event_description TEXT,
    actor_name TEXT,
    thread_id UUID,
    thread_context JSONB
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
            NULL::UUID,
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
            NULL::UUID as thread_id,
            jsonb_build_object(
                'ticket_id', t.id,
                'title', t.title,
                'description', t.description
            ) as thread_context
        FROM public.tickets t
        LEFT JOIN public.profiles p ON p.id = t.user_id
        WHERE t.id = p_ticket_id
        AND NOT t.deleted

        UNION ALL

        -- Thread creation and updates
        SELECT 
            t.created_at as event_time,
            'thread_created' as event_type,
            CASE
                WHEN t.title IS NOT NULL THEN format('New thread created: %s', t.title)
                ELSE 'New thread created'
            END as event_description,
            COALESCE(
                CASE 
                    WHEN p.role = 'agent' THEN 'Support Agent'
                    WHEN p.role = 'admin' THEN 'Support Admin'
                    ELSE p.full_name
                END,
                'System'
            ) as actor_name,
            t.id as thread_id,
            jsonb_build_object(
                'title', t.title,
                'thread_type', t.thread_type,
                'ai_context', t.ai_context
            ) as thread_context
        FROM public.ticket_threads t
        LEFT JOIN public.profiles p ON p.id = t.created_by
        WHERE t.ticket_id = p_ticket_id
        AND NOT t.deleted

        UNION ALL

        -- Messages in threads
        SELECT 
            n.created_at as event_time,
            'message_added' as event_type,
            n.content as event_description,
            COALESCE(
                CASE 
                    WHEN p.role = 'agent' THEN 'Support Agent'
                    WHEN p.role = 'admin' THEN 'Support Admin'
                    ELSE p.full_name
                END,
                'System'
            ) as actor_name,
            n.thread_id,
            jsonb_build_object(
                'message_type', n.message_type,
                'ai_processed', COALESCE(n.metadata->>'ai_processed', 'false')
            ) as thread_context
        FROM public.ticket_notes n
        LEFT JOIN public.profiles p ON p.id = n.created_by
        WHERE n.ticket_id = p_ticket_id
        AND NOT n.deleted
        AND NOT n.is_internal

        UNION ALL

        -- Status changes from audit logs
        SELECT 
            a.created_at as event_time,
            'status_change' as event_type,
            format('Status changed to %s', 
                CASE a.new_data->>'status'
                    WHEN 'open' THEN 'Open'
                    WHEN 'in_progress' THEN 'In Progress'
                    WHEN 'resolved' THEN 'Resolved'
                    WHEN 'closed' THEN 'Closed'
                    ELSE a.new_data->>'status'
                END
            ) as event_description,
            COALESCE(
                CASE 
                    WHEN p.role = 'agent' THEN 'Support Agent'
                    WHEN p.role = 'admin' THEN 'Support Admin'
                    ELSE p.full_name
                END,
                'System'
            ) as actor_name,
            NULL::UUID as thread_id,
            jsonb_build_object(
                'old_status', a.old_data->>'status',
                'new_status', a.new_data->>'status'
            ) as thread_context
        FROM public.audit_logs a
        LEFT JOIN public.profiles p ON p.id = a.user_id
        WHERE a.table_name = 'tickets'
        AND a.record_id = p_ticket_id
        AND (a.new_data->>'status') IS DISTINCT FROM (a.old_data->>'status')

        UNION ALL

        -- Assignment changes from audit logs
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
            NULL::UUID as thread_id,
            jsonb_build_object(
                'assigned_to', a.new_data->>'assigned_to'
            ) as thread_context
        FROM public.audit_logs a
        LEFT JOIN public.profiles p ON p.id = a.user_id
        WHERE a.table_name = 'tickets'
        AND a.record_id = p_ticket_id
        AND (a.new_data->>'assigned_to') IS DISTINCT FROM (a.old_data->>'assigned_to')
    ) events
    ORDER BY event_time DESC;
END;
$$;

-- Update trigger for updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp') THEN
        CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON public.ticket_threads
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
    END IF;
END $$;

-- Drop existing policies if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can delete any ticket" ON public.tickets;
    DROP POLICY IF EXISTS "Customers can view their ticket threads" ON public.ticket_threads;
    DROP POLICY IF EXISTS "Agents can view assigned ticket threads" ON public.ticket_threads;
    DROP POLICY IF EXISTS "Admins can view all threads" ON public.ticket_threads;
    DROP POLICY IF EXISTS "Customers can create threads" ON public.ticket_threads;
    DROP POLICY IF EXISTS "Agents can create threads on assigned tickets" ON public.ticket_threads;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Enable RLS
ALTER TABLE public.ticket_threads ENABLE ROW LEVEL SECURITY;

-- Create policies with existence checks
DO $$ 
BEGIN
    -- Check if delete policy exists before creating
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete any ticket' AND tablename = 'tickets') THEN
        CREATE POLICY "Admins can delete any ticket"
            ON public.tickets FOR DELETE
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid()
                    AND role = 'admin'
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can view their ticket threads') THEN
        CREATE POLICY "Customers can view their ticket threads"
            ON public.ticket_threads FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.tickets t
                    WHERE t.id = ticket_id
                    AND t.user_id = auth.uid()
                    AND NOT t.deleted
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Agents can view assigned ticket threads') THEN
        CREATE POLICY "Agents can view assigned ticket threads"
            ON public.ticket_threads FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.tickets t
                    JOIN public.profiles p ON p.id = auth.uid()
                    WHERE t.id = ticket_id
                    AND p.role = 'agent'
                    AND t.assigned_to = auth.uid()
                    AND NOT t.deleted
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all threads') THEN
        CREATE POLICY "Admins can view all threads"
            ON public.ticket_threads FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid()
                    AND role = 'admin'
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can create threads') THEN
        CREATE POLICY "Customers can create threads"
            ON public.ticket_threads FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.tickets t
                    WHERE t.id = ticket_id
                    AND t.user_id = auth.uid()
                    AND NOT t.deleted
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Agents can create threads on assigned tickets') THEN
        CREATE POLICY "Agents can create threads on assigned tickets"
            ON public.ticket_threads FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.tickets t
                    JOIN public.profiles p ON p.id = auth.uid()
                    WHERE t.id = ticket_id
                    AND p.role = 'agent'
                    AND t.assigned_to = auth.uid()
                    AND NOT t.deleted
                )
            );
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.ticket_threads TO authenticated;
GRANT ALL ON public.ticket_threads TO service_role;

-- Grant permissions for ticket_notes
GRANT ALL ON public.ticket_notes TO authenticated;
GRANT ALL ON public.ticket_notes TO service_role;

-- Grant permissions for the view
GRANT SELECT ON public.customer_ticket_notes TO authenticated;
GRANT SELECT ON public.customer_ticket_notes TO service_role;

-- Grant execute permission on the timeline function
GRANT EXECUTE ON FUNCTION public.get_customer_ticket_timeline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_ticket_timeline(UUID) TO service_role;

-- Enable realtime for ticket_threads table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'ticket_threads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ticket_threads;
    END IF;
END $$;

-- Check and set replica identity for ticket_threads
DO $$
BEGIN
    -- Check current replica identity
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = 'ticket_threads'
        AND c.relreplident != 'f'  -- 'f' means FULL
    ) THEN
        -- Set to FULL if not already
        ALTER TABLE public.ticket_threads REPLICA IDENTITY FULL;
    END IF;
END $$;

-- Enable realtime for ticket_notes table as well
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'ticket_notes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ticket_notes;
    END IF;
END $$;

-- Check and set replica identity for ticket_notes
DO $$
BEGIN
    -- Check current replica identity
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = 'ticket_notes'
        AND c.relreplident != 'f'  -- 'f' means FULL
    ) THEN
        -- Set to FULL if not already
        ALTER TABLE public.ticket_notes REPLICA IDENTITY FULL;
    END IF;
END $$;

-- Grant realtime permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable realtime for tickets table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'tickets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
    END IF;
END $$;

-- Check and set replica identity for tickets
DO $$
BEGIN
    -- Check current replica identity
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = 'tickets'
        AND c.relreplident != 'f'  -- 'f' means FULL
    ) THEN
        -- Set to FULL if not already
        ALTER TABLE public.tickets REPLICA IDENTITY FULL;
    END IF;
END $$;

-- Ensure publication exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Add RLS policies for ticket_threads
ALTER TABLE public.ticket_threads ENABLE ROW LEVEL SECURITY;

-- Policy for agents to view threads of tickets assigned to them
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Agents can view threads of assigned tickets' AND tablename = 'ticket_threads') THEN
        CREATE POLICY "Agents can view threads of assigned tickets" ON public.ticket_threads
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.tickets t
                    WHERE t.id = ticket_id
                    AND t.assigned_to = auth.uid()
                    AND NOT t.deleted
                )
            );
    END IF;
END $$;

-- Policy for agents to create threads on assigned tickets
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Agents can create threads on assigned tickets' AND tablename = 'ticket_threads') THEN
        CREATE POLICY "Agents can create threads on assigned tickets" ON public.ticket_threads
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.tickets t
                    WHERE t.id = ticket_id
                    AND t.assigned_to = auth.uid()
                    AND NOT t.deleted
                )
            );
    END IF;
END $$;

-- Policy for agents to update threads on assigned tickets
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Agents can update threads on assigned tickets' AND tablename = 'ticket_threads') THEN
        CREATE POLICY "Agents can update threads on assigned tickets" ON public.ticket_threads
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM public.tickets t
                    WHERE t.id = ticket_id
                    AND t.assigned_to = auth.uid()
                    AND NOT t.deleted
                )
            );
    END IF;
END $$;

-- Add RLS policies for ticket_notes
DO $$ 
BEGIN
    -- Drop existing policies first
    DROP POLICY IF EXISTS "Agents can create notes on threads" ON public.ticket_notes;
    DROP POLICY IF EXISTS "Agents can view notes on thread" ON public.ticket_notes;

    -- Create new policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Agents can create notes on threads' AND tablename = 'ticket_notes') THEN
        CREATE POLICY "Agents can create notes on threads"
            ON public.ticket_notes FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.ticket_threads t
                    JOIN public.tickets tk ON tk.id = t.ticket_id
                    WHERE t.id = ticket_notes.thread_id
                    AND tk.assigned_to = auth.uid()
                    AND NOT t.deleted
                )
                AND created_by = auth.uid()
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Agents can view notes on thread' AND tablename = 'ticket_notes') THEN
        CREATE POLICY "Agents can view notes on thread"
            ON public.ticket_notes FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.ticket_threads t
                    JOIN public.tickets tk ON tk.id = t.ticket_id
                    WHERE t.id = ticket_notes.thread_id
                    AND tk.assigned_to = auth.uid()
                    AND NOT t.deleted
                )
            );
    END IF;
END $$; 