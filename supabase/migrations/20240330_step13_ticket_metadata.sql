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

-- Create function to validate ticket metadata
CREATE OR REPLACE FUNCTION public.validate_ticket_metadata()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get current user ID safely
    v_user_id := COALESCE(auth.uid(), NEW.user_id);

    -- Initialize metadata if NULL
    IF NEW.metadata IS NULL THEN
        NEW.metadata := '{}'::jsonb;
    END IF;

    -- Ensure metadata is an object
    IF NOT (NEW.metadata @> '{}'::jsonb) THEN
        RAISE EXCEPTION 'Metadata must be a JSON object';
    END IF;

    -- Initialize current_state if not present
    IF NOT (NEW.metadata ? 'current_state') THEN
        NEW.metadata := jsonb_set(
            NEW.metadata,
            '{current_state}',
            jsonb_build_object(
                'name', NEW.status::text,
                'entered_at', CURRENT_TIMESTAMP,
                'updated_by', v_user_id
            )
        );
    END IF;

    -- Initialize state_transitions if not present
    IF NOT (NEW.metadata ? 'state_transitions') THEN
        NEW.metadata := jsonb_set(
            NEW.metadata,
            '{state_transitions}',
            '[]'::jsonb
        );
    END IF;

    -- Validate fields only if they exist
    IF (NEW.metadata ? 'status_history' AND NOT jsonb_typeof(NEW.metadata->'status_history') = 'array') THEN
        RAISE EXCEPTION 'status_history must be an array';
    END IF;

    IF (NEW.metadata ? 'last_updated_by' AND NOT jsonb_typeof(NEW.metadata->'last_updated_by') = 'string') THEN
        RAISE EXCEPTION 'last_updated_by must be a string';
    END IF;

    IF (NEW.metadata ? 'resolution_time' AND NOT jsonb_typeof(NEW.metadata->'resolution_time') = 'number') THEN
        RAISE EXCEPTION 'resolution_time must be a number';
    END IF;

    IF (NEW.metadata ? 'security_level' AND NOT jsonb_typeof(NEW.metadata->'security_level') = 'string') THEN
        RAISE EXCEPTION 'security_level must be a string';
    END IF;

    IF (NEW.metadata ? 'security_classification' AND NOT jsonb_typeof(NEW.metadata->'security_classification') = 'string') THEN
        RAISE EXCEPTION 'security_classification must be a string';
    END IF;

    IF (NEW.metadata ? 'source' AND NOT jsonb_typeof(NEW.metadata->'source') = 'string') THEN
        RAISE EXCEPTION 'source field must be a string';
    END IF;
    
    IF (NEW.metadata ? 'sla_level' AND NOT jsonb_typeof(NEW.metadata->'sla_level') = 'string') THEN
        RAISE EXCEPTION 'sla_level field must be a string';
    END IF;

    RETURN NEW;
END;
$$;

-- Create function to update ticket state
CREATE OR REPLACE FUNCTION public.update_ticket_state(
    p_ticket_id UUID,
    p_new_state TEXT,
    p_user_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_state JSONB;
    v_transitions JSONB;
    v_timestamp TIMESTAMPTZ;
BEGIN
    -- Get current timestamp
    v_timestamp := NOW();

    -- Get current state and transitions
    SELECT 
        metadata->'current_state',
        metadata->'state_transitions'
    INTO v_current_state, v_transitions
    FROM public.tickets
    WHERE id = p_ticket_id;

    -- Initialize arrays if null
    IF v_transitions IS NULL THEN
        v_transitions := '[]'::jsonb;
    END IF;

    -- Create new transition
    v_transitions := v_transitions || jsonb_build_object(
        'from_state', COALESCE(v_current_state->>'name', 'none'),
        'to_state', p_new_state,
        'timestamp', v_timestamp,
        'user_id', p_user_id
    );

    -- Update ticket metadata
    UPDATE public.tickets
    SET metadata = jsonb_set(
        jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{state_transitions}',
            v_transitions
        ),
        '{current_state}',
        jsonb_build_object(
            'name', p_new_state,
            'entered_at', v_timestamp,
            'updated_by', p_user_id
        )
    )
    WHERE id = p_ticket_id;
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
GRANT EXECUTE ON FUNCTION public.update_ticket_state(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ticket_state(UUID, TEXT, UUID) TO service_role; 