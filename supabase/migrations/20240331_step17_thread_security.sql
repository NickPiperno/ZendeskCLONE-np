-- Enable RLS on ticket_threads table
ALTER TABLE public.ticket_threads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Customers can view messages in their threads" ON public.ticket_notes;
DROP POLICY IF EXISTS "Customers can view their own ticket threads" ON public.ticket_threads;
DROP POLICY IF EXISTS "Agents can view assigned ticket threads" ON public.ticket_threads;
DROP POLICY IF EXISTS "Admins can view all ticket threads" ON public.ticket_threads;
DROP POLICY IF EXISTS "Customers can create threads on their tickets" ON public.ticket_threads;
DROP POLICY IF EXISTS "Agents can create threads on assigned tickets" ON public.ticket_threads;
DROP POLICY IF EXISTS "Admins can create threads on any ticket" ON public.ticket_threads;
DROP POLICY IF EXISTS "Agents can update threads on assigned tickets" ON public.ticket_threads;
DROP POLICY IF EXISTS "Admins can update any thread" ON public.ticket_threads;

-- Thread visibility policies
CREATE POLICY "Customers can view their own ticket threads"
ON public.ticket_threads
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_id
        AND t.user_id = auth.uid()
        AND NOT t.deleted
        AND NOT deleted
    )
);

CREATE POLICY "Agents can view assigned ticket threads"
ON public.ticket_threads
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_id
        AND t.assigned_to = auth.uid()
        AND NOT t.deleted
        AND NOT deleted
    )
);

CREATE POLICY "Admins can view all ticket threads"
ON public.ticket_threads
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
);

-- Thread creation policies
CREATE POLICY "Customers can create threads on their tickets"
ON public.ticket_threads
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_id
        AND t.user_id = auth.uid()
        AND NOT t.deleted
    )
    AND thread_type = 'customer_initiated'
    AND NOT deleted
);

CREATE POLICY "Agents can create threads on assigned tickets"
ON public.ticket_threads
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_id
        AND t.assigned_to = auth.uid()
        AND NOT t.deleted
    )
    AND thread_type IN ('agent_initiated', 'ai_initiated')
    AND NOT deleted
);

CREATE POLICY "Admins can create threads on any ticket"
ON public.ticket_threads
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
);

-- Thread update policies
CREATE POLICY "Agents can update threads on assigned tickets"
ON public.ticket_threads
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_id
        AND t.assigned_to = auth.uid()
        AND NOT t.deleted
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_id
        AND t.assigned_to = auth.uid()
        AND NOT t.deleted
    )
);

CREATE POLICY "Admins can update any thread"
ON public.ticket_threads
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
);

-- Message policies
ALTER TABLE public.ticket_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing message policies if any
DROP POLICY IF EXISTS "Customers can view messages in their threads" ON public.ticket_notes;
DROP POLICY IF EXISTS "Agents can view messages in assigned threads" ON public.ticket_notes;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.ticket_notes;
DROP POLICY IF EXISTS "Customers can create messages in their threads" ON public.ticket_notes;
DROP POLICY IF EXISTS "Agents can create messages in assigned threads" ON public.ticket_notes;
DROP POLICY IF EXISTS "Admins can create messages in any thread" ON public.ticket_notes;

-- Message visibility policies
CREATE POLICY "Customers can view messages in their threads"
ON public.ticket_notes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.tickets t
        JOIN public.ticket_threads tt ON tt.ticket_id = t.id
        WHERE tt.id = thread_id
        AND t.user_id = auth.uid()
        AND NOT t.deleted
        AND NOT tt.deleted
        AND NOT is_internal
    )
);

CREATE POLICY "Agents can view messages in assigned threads"
ON public.ticket_notes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.tickets t
        JOIN public.ticket_threads tt ON tt.ticket_id = t.id
        WHERE tt.id = thread_id
        AND t.assigned_to = auth.uid()
        AND NOT t.deleted
        AND NOT tt.deleted
    )
);

CREATE POLICY "Admins can view all messages"
ON public.ticket_notes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
);

-- Message creation policies
CREATE POLICY "Customers can create messages in their threads"
ON public.ticket_notes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tickets t
        JOIN public.ticket_threads tt ON tt.ticket_id = t.id
        WHERE tt.id = thread_id
        AND t.user_id = auth.uid()
        AND NOT t.deleted
        AND NOT tt.deleted
        AND tt.thread_type = 'customer_initiated'
    )
    AND message_type = 'customer'
    AND NOT is_internal
);

CREATE POLICY "Agents can create messages in assigned threads"
ON public.ticket_notes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tickets t
        JOIN public.ticket_threads tt ON tt.ticket_id = t.id
        WHERE tt.id = thread_id
        AND t.assigned_to = auth.uid()
        AND NOT t.deleted
        AND NOT tt.deleted
    )
    AND message_type IN ('agent', 'ai')
);

CREATE POLICY "Admins can create messages in any thread"
ON public.ticket_notes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
); 