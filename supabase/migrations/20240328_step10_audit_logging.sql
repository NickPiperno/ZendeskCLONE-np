-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;

-- Create policy for viewing audit logs (admin only)
CREATE POLICY "Only admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Function to record audit logs
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

    -- Convert old/new data to JSON, excluding system columns
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        old_data_json = to_jsonb(OLD);
        -- Remove system columns
        old_data_json = old_data_json - 'created_at' - 'updated_at';
    END IF;

    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        new_data_json = to_jsonb(NEW);
        -- Remove system columns
        new_data_json = new_data_json - 'created_at' - 'updated_at';
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

    -- Return appropriate record based on operation
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS audit_tickets_changes ON public.tickets;
DROP TRIGGER IF EXISTS audit_ticket_notes_changes ON public.ticket_notes;
DROP TRIGGER IF EXISTS audit_profiles_changes ON public.profiles;

-- Create triggers for tables we want to audit
CREATE TRIGGER audit_tickets_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_ticket_notes_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.ticket_notes
    FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER audit_profiles_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

-- Function to view audit history for a specific record
CREATE OR REPLACE FUNCTION public.get_record_history(
    p_table_name TEXT,
    p_record_id UUID
)
RETURNS TABLE (
    created_at TIMESTAMPTZ,
    user_email TEXT,
    action_type TEXT,
    changes JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.created_at,
        p.email as user_email,
        al.action_type,
        CASE
            WHEN al.action_type = 'INSERT' THEN al.new_data
            WHEN al.action_type = 'DELETE' THEN al.old_data
            ELSE jsonb_strip_nulls(
                jsonb_object_agg(
                    key,
                    CASE
                        WHEN al.old_data->key IS DISTINCT FROM al.new_data->key
                        THEN jsonb_build_object('old', al.old_data->key, 'new', al.new_data->key)
                        ELSE NULL
                    END
                )
            )
        END as changes
    FROM public.audit_logs al
    LEFT JOIN public.profiles p ON p.id = al.user_id
    WHERE al.table_name = p_table_name
    AND al.record_id = p_record_id
    GROUP BY al.id, al.created_at, p.email, al.action_type, al.old_data, al.new_data
    ORDER BY al.created_at DESC;
END;
$$;

-- Grant permissions
GRANT ALL ON public.audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_audit_log() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_record_history(TEXT, UUID) TO authenticated; 