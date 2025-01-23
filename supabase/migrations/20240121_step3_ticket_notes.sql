-- Create ticket notes table
CREATE TABLE public.ticket_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ticket_id UUID REFERENCES public.tickets(id),
    created_by UUID REFERENCES auth.users(id),
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.ticket_notes ENABLE ROW LEVEL SECURITY;

-- Policies for ticket notes
CREATE POLICY "Users can view notes on their tickets"
    ON public.ticket_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tickets
            WHERE tickets.id = ticket_notes.ticket_id
            AND tickets.user_id = auth.uid()
            AND NOT tickets.deleted
        )
        AND NOT ticket_notes.deleted
        AND NOT ticket_notes.is_internal
    );

CREATE POLICY "Admins and agents can view all notes"
    ON public.ticket_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'agent')
        )
        AND NOT ticket_notes.deleted
    );

CREATE POLICY "Users can create notes on their tickets"
    ON public.ticket_notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tickets
            WHERE tickets.id = ticket_id
            AND tickets.user_id = auth.uid()
            AND NOT tickets.deleted
        )
        AND created_by = auth.uid()
        AND NOT is_internal
    );

CREATE POLICY "Admins and agents can create any notes"
    ON public.ticket_notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'agent')
        )
        AND created_by = auth.uid()
    );

CREATE POLICY "Users can update their own notes"
    ON public.ticket_notes FOR UPDATE
    USING (
        created_by = auth.uid()
        AND NOT deleted
        AND NOT is_internal
    )
    WITH CHECK (
        created_by = auth.uid()
        AND NOT deleted
        AND NOT is_internal
    );

CREATE POLICY "Admins and agents can update any notes"
    ON public.ticket_notes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'agent')
        )
        AND NOT deleted
    );

-- Create soft delete function for notes
CREATE OR REPLACE FUNCTION public.soft_delete_ticket_note(note_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.ticket_notes
    SET deleted = true,
        deleted_at = NOW()
    WHERE id = note_id
    AND (
        -- User owns the note
        created_by = auth.uid()
        OR
        -- User is admin or agent
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'agent')
        )
    );
END;
$$;

-- Grant permissions
GRANT ALL ON public.ticket_notes TO authenticated;
GRANT ALL ON public.ticket_notes TO service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_ticket_note(UUID) TO authenticated; 