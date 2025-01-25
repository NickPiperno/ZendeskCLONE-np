-- Drop and recreate ticket_assignments table if needed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'ticket_assignments'
    ) THEN
        CREATE TABLE public.ticket_assignments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
            agent_id UUID REFERENCES auth.users(id),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(ticket_id, agent_id)
        );
    END IF;
END $$;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_ticket_assignments_ticket_id;
DROP INDEX IF EXISTS idx_ticket_assignments_agent_id;

-- Create indexes for efficient querying
CREATE INDEX idx_ticket_assignments_ticket_id ON public.ticket_assignments(ticket_id);
CREATE INDEX idx_ticket_assignments_agent_id ON public.ticket_assignments(agent_id);

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS set_timestamp ON public.ticket_assignments;

-- Create trigger for updating timestamp
CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.ticket_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS
ALTER TABLE public.ticket_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Agents and admins can view assignments" ON public.ticket_assignments;
DROP POLICY IF EXISTS "Agents and admins can manage assignments" ON public.ticket_assignments;

-- Create policies
CREATE POLICY "Agents and admins can view assignments"
    ON public.ticket_assignments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND (p.role = 'agent' OR p.role = 'admin')
        )
    );

CREATE POLICY "Agents and admins can manage assignments"
    ON public.ticket_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
            AND (p.role = 'agent' OR p.role = 'admin')
        )
    );

-- Grant permissions
GRANT ALL ON public.ticket_assignments TO authenticated;
GRANT ALL ON public.ticket_assignments TO service_role; 