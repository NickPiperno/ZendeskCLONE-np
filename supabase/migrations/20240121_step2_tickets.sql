-- Create tickets table
CREATE TABLE public.tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    description TEXT,
    status ticket_status DEFAULT 'open',
    priority ticket_priority DEFAULT 'medium',
    user_id UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Policies for tickets
CREATE POLICY "Users can view their own tickets"
    ON public.tickets FOR SELECT
    USING (
        auth.uid() = user_id
        AND NOT deleted
    );

CREATE POLICY "Admins and agents can view all tickets"
    ON public.tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'agent')
        )
        AND NOT deleted
    );

CREATE POLICY "Users can create tickets"
    ON public.tickets FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY "Users can update their own tickets"
    ON public.tickets FOR UPDATE
    USING (
        auth.uid() = user_id
        AND NOT deleted
    )
    WITH CHECK (
        auth.uid() = user_id
        AND NOT deleted
    );

CREATE POLICY "Admins and agents can update any ticket"
    ON public.tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'agent')
        )
        AND NOT deleted
    );

-- Grant permissions
GRANT ALL ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

-- Create soft delete function
CREATE OR REPLACE FUNCTION public.soft_delete_ticket(ticket_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.tickets
    SET deleted = true,
        deleted_at = NOW()
    WHERE id = ticket_id
    AND (
        -- User owns the ticket
        auth.uid() = user_id
        OR
        -- User is admin or agent
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'agent')
        )
    );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.soft_delete_ticket(UUID) TO authenticated; 