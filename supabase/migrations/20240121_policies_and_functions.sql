-- Drop everything in the correct order
DROP TRIGGER IF EXISTS set_ticket_user_id_trigger ON tickets;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS update_ticket_notes_updated_at ON ticket_notes;

DROP FUNCTION IF EXISTS set_ticket_user_id() CASCADE;
DROP FUNCTION IF EXISTS soft_delete_ticket(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_table_info(text) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Users can update their tickets" ON tickets;
DROP POLICY IF EXISTS "ticket_notes_select_policy" ON ticket_notes;
DROP POLICY IF EXISTS "ticket_notes_insert_policy" ON ticket_notes;
DROP POLICY IF EXISTS "ticket_notes_update_policy" ON ticket_notes;

-- Create functions first
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the table info function with REST API exposure
CREATE OR REPLACE FUNCTION get_table_info(table_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
/*
 * Retrieves information about a database table
 * @param {text} table_name - The name of the table to get information about
 * @returns {jsonb} Table information including existence, columns, constraints, and policies
 */
DECLARE
  result jsonb;
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Only admins can view table information.';
  END IF;

  SELECT jsonb_build_object(
    'exists', EXISTS (
      SELECT FROM information_schema.tables t
      WHERE t.table_schema = 'public' 
      AND t.table_name = get_table_info.table_name
    ),
    'columns', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', c.column_name,
        'type', c.data_type,
        'nullable', c.is_nullable,
        'default', c.column_default
      ))
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
      AND c.table_name = get_table_info.table_name
    ),
    'constraints', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', tc.constraint_name,
        'type', tc.constraint_type
      ))
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
      AND tc.table_name = get_table_info.table_name
    ),
    'policies', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', p.polname,
        'command', CASE p.polcmd
          WHEN 'r' THEN 'SELECT'
          WHEN 'a' THEN 'INSERT'
          WHEN 'w' THEN 'UPDATE'
          WHEN 'd' THEN 'DELETE'
          ELSE p.polcmd::text
        END,
        'roles', p.polroles
      ))
      FROM pg_policy p
      JOIN pg_class c ON p.polrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
      AND c.relname = get_table_info.table_name
    )
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION soft_delete_ticket(ticket_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the user owns the ticket
  IF NOT EXISTS (
    SELECT 1 FROM tickets 
    WHERE id = ticket_id 
    AND user_id = auth.uid()
    AND deleted = false
  ) THEN
    RAISE EXCEPTION 'Ticket not found or not authorized';
  END IF;

  -- Perform the soft delete
  UPDATE tickets 
  SET 
    deleted = true,
    deleted_at = NOW()
  WHERE id = ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION set_ticket_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_notes_updated_at
    BEFORE UPDATE ON ticket_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_ticket_user_id_trigger
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_user_id();

-- Create policies
CREATE POLICY "profiles_select_policy" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "profiles_insert_policy" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_policy" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own tickets"
ON tickets
FOR SELECT
USING (
    (auth.uid() = user_id OR auth.uid() = assigned_to) AND
    deleted = false
);

CREATE POLICY "Users can create tickets"
ON tickets
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their tickets"
ON tickets
FOR UPDATE
USING (
    auth.uid() = user_id AND
    deleted = false
);

CREATE POLICY "ticket_notes_select_policy" ON ticket_notes
FOR SELECT USING (
    (
        -- Agents can see all notes
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'agent')
        )
    ) OR (
        -- Users can only see non-internal notes for their tickets
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_notes.ticket_id
            AND t.user_id = auth.uid()
        )
        AND NOT is_internal
    )
);

CREATE POLICY "ticket_notes_insert_policy" ON ticket_notes
FOR INSERT WITH CHECK (
    -- Only authenticated users can create notes
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    -- Only agents can create internal notes
    AND (
        NOT is_internal OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'agent')
        )
    )
);

CREATE POLICY "ticket_notes_update_policy" ON ticket_notes
FOR UPDATE USING (
    -- Only the creator can update their notes
    created_by = auth.uid()
)
WITH CHECK (
    -- Only agents can create internal notes
    NOT is_internal OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'agent')
    )
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_table_info(text) TO authenticated; 