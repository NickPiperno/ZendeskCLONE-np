-- Add metadata column to tickets table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tickets' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.tickets
        ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Drop index if exists before creating
DROP INDEX IF EXISTS idx_tickets_metadata;

-- Create GIN index for efficient JSONB querying
CREATE INDEX idx_tickets_metadata ON public.tickets USING gin (metadata);

-- Create function to validate metadata structure
CREATE OR REPLACE FUNCTION public.validate_ticket_metadata()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Ensure metadata is an object
    IF NOT (NEW.metadata @> '{}'::jsonb) THEN
        RAISE EXCEPTION 'Metadata must be a JSON object';
    END IF;

    -- Add any additional validation rules here
    -- Example: Ensure specific fields are of correct type
    IF (NEW.metadata ? 'source' AND NOT jsonb_typeof(NEW.metadata->'source') = 'string') THEN
        RAISE EXCEPTION 'source field must be a string';
    END IF;
    
    IF (NEW.metadata ? 'sla_level' AND NOT jsonb_typeof(NEW.metadata->'sla_level') = 'string') THEN
        RAISE EXCEPTION 'sla_level field must be a string';
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for metadata validation
DROP TRIGGER IF EXISTS validate_ticket_metadata ON public.tickets;
CREATE TRIGGER validate_ticket_metadata
    BEFORE INSERT OR UPDATE ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_ticket_metadata();

-- Update audit logging to properly handle JSONB differences
CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    old_data_json JSONB;
    new_data_json JSONB;
    user_id UUID;
    client_info RECORD;
BEGIN
    -- Get current user ID
    SELECT auth.uid() INTO user_id;
    
    -- Get client info from request headers
    SELECT 
        current_setting('request.headers', true)::json->>'x-real-ip' as ip,
        current_setting('request.headers', true)::json->>'user-agent' as agent
    INTO client_info;

    -- Convert OLD and NEW to JSONB, handling JSONB fields properly
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        old_data_json = to_jsonb(OLD);
    END IF;
    
    IF TG_OP IN ('UPDATE', 'INSERT') THEN
        new_data_json = to_jsonb(NEW);
    END IF;

    -- Insert audit log
    INSERT INTO public.audit_logs (
        user_id,
        action_type,
        table_name,
        record_id,
        old_data,
        new_data,
        ip_address,
        user_agent
    ) VALUES (
        user_id,
        TG_OP,
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        old_data_json,
        new_data_json,
        client_info.ip,
        client_info.agent
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Grant necessary permissions
GRANT ALL ON FUNCTION public.validate_ticket_metadata() TO authenticated;
GRANT ALL ON FUNCTION public.validate_ticket_metadata() TO service_role; 