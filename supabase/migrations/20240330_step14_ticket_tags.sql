-- Drop and recreate tags table if needed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'tags'
    ) THEN
        CREATE TABLE public.tags (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            color TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Drop and recreate ticket_tags table if needed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'ticket_tags'
    ) THEN
        CREATE TABLE public.ticket_tags (
            ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
            tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (ticket_id, tag_id)
        );
    END IF;
END $$;

-- Drop indexes if they exist
DROP INDEX IF EXISTS idx_ticket_tags_ticket_id;
DROP INDEX IF EXISTS idx_ticket_tags_tag_id;

-- Create indexes for efficient querying
CREATE INDEX idx_ticket_tags_ticket_id ON public.ticket_tags(ticket_id);
CREATE INDEX idx_ticket_tags_tag_id ON public.ticket_tags(tag_id);

-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Agents and admins can view tags" ON public.tags;
DROP POLICY IF EXISTS "Agents and admins can create tags" ON public.tags;
DROP POLICY IF EXISTS "Agents and admins can update tags" ON public.tags;
DROP POLICY IF EXISTS "Agents and admins can delete tags" ON public.tags;

DROP POLICY IF EXISTS "Agents and admins can view ticket tags" ON public.ticket_tags;
DROP POLICY IF EXISTS "Agents and admins can manage ticket tags" ON public.ticket_tags;

-- Create policies for tags table
CREATE POLICY "Agents and admins can view tags"
    ON public.tags
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND (p.role = 'agent' OR p.role = 'admin')
        )
    );

CREATE POLICY "Agents and admins can create tags"
    ON public.tags
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND (p.role = 'agent' OR p.role = 'admin')
        )
    );

CREATE POLICY "Agents and admins can update tags"
    ON public.tags
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND (p.role = 'agent' OR p.role = 'admin')
        )
    );

CREATE POLICY "Agents and admins can delete tags"
    ON public.tags
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND (p.role = 'agent' OR p.role = 'admin')
        )
    );

-- Create policies for ticket_tags table
CREATE POLICY "Agents and admins can view ticket tags"
    ON public.ticket_tags
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND (p.role = 'agent' OR p.role = 'admin')
        )
    );

CREATE POLICY "Agents and admins can manage ticket tags"
    ON public.ticket_tags
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND (p.role = 'agent' OR p.role = 'admin')
        )
    );

-- Grant permissions
GRANT ALL ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
GRANT ALL ON public.ticket_tags TO authenticated;
GRANT ALL ON public.ticket_tags TO service_role;

-- Create function to remove tag from ticket
CREATE OR REPLACE FUNCTION public.remove_ticket_tag(p_ticket_id UUID, p_tag_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.ticket_tags
    WHERE ticket_id = p_ticket_id
    AND tag_id = p_tag_id
    AND (
        -- User owns the ticket
        EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = p_ticket_id
            AND t.user_id = auth.uid()
            AND NOT t.deleted
        )
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
            WHERE t.id = p_ticket_id
            AND p.role = 'agent'
            AND t.assigned_to = auth.uid()
            AND NOT t.deleted
        )
    );
END;
$$;

-- Create view for ticket tag summaries
CREATE OR REPLACE VIEW public.ticket_tag_summaries AS
SELECT 
    t.id as ticket_id,
    array_agg(tags.name) as tag_names,
    array_agg(tags.color) as tag_colors,
    array_agg(tags.id) as tag_ids
FROM public.tickets t
LEFT JOIN public.ticket_tags tt ON t.id = tt.ticket_id
LEFT JOIN public.tags tags ON tt.tag_id = tags.id
WHERE NOT t.deleted
GROUP BY t.id;

-- Grant permissions
GRANT ALL ON public.ticket_tag_summaries TO authenticated;
GRANT ALL ON public.ticket_tag_summaries TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_ticket_tag(UUID, UUID) TO authenticated; 