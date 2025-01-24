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

-- Add foreign key constraint for profiles
ALTER TABLE public.ticket_notes
    ADD CONSTRAINT ticket_notes_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.profiles(id);

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

CREATE POLICY "Admins can view all notes"
    ON public.ticket_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        AND NOT ticket_notes.deleted
    );

CREATE POLICY "Agents can view notes on assigned tickets"
    ON public.ticket_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tickets t
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE t.id = ticket_notes.ticket_id
            AND p.role = 'agent'
            AND t.assigned_to = auth.uid()
            AND NOT t.deleted
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

CREATE POLICY "Admins can create any notes"
    ON public.ticket_notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        AND created_by = auth.uid()
    );

CREATE POLICY "Agents can create notes on assigned tickets"
    ON public.ticket_notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tickets t
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE t.id = ticket_id
            AND p.role = 'agent'
            AND t.assigned_to = auth.uid()
            AND NOT t.deleted
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

CREATE POLICY "Admins can update any notes"
    ON public.ticket_notes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        AND NOT deleted
    );

CREATE POLICY "Agents can update notes on assigned tickets"
    ON public.ticket_notes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tickets t
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE t.id = ticket_notes.ticket_id
            AND p.role = 'agent'
            AND t.assigned_to = auth.uid()
            AND NOT t.deleted
        )
        AND NOT deleted
    );

-- Update soft delete function for notes
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
        -- User is admin
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        -- Agent is assigned to the ticket
        EXISTS (
            SELECT 1 FROM public.tickets t
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE t.id = ticket_notes.ticket_id
            AND p.role = 'agent'
            AND t.assigned_to = auth.uid()
            AND NOT t.deleted
        )
    );
END;
$$;

-- Grant permissions
GRANT ALL ON public.ticket_notes TO authenticated;
GRANT ALL ON public.ticket_notes TO service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_ticket_note(UUID) TO authenticated; 