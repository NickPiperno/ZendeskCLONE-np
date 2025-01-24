-- Drop existing functions first
DROP FUNCTION IF EXISTS get_database_size();
DROP FUNCTION IF EXISTS get_query_metrics();
DROP FUNCTION IF EXISTS get_ticket_resolution_metrics();
DROP FUNCTION IF EXISTS get_agent_performance_metrics();

-- Function to get database size
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS TABLE (
  table_name name,
  row_count bigint,
  total_size_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    relname::name as table_name,
    n_live_tup::bigint as row_count,
    pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))::bigint as total_size_bytes
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY total_size_bytes DESC;
END;
$$;

-- Function to get query performance metrics
CREATE OR REPLACE FUNCTION get_query_metrics()
RETURNS TABLE (
  query_type text,
  avg_exec_time double precision,
  calls bigint,
  rows_per_call double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if pg_stat_statements is installed
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
  ) THEN
    RETURN QUERY SELECT 
      'pg_stat_statements not installed'::text,
      0::double precision,
      0::bigint,
      0::double precision;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    substring(s.query for 50)::text as query_type,
    (s.total_exec_time / NULLIF(s.calls, 0))::double precision as avg_exec_time,
    s.calls::bigint,
    (s.rows::double precision / NULLIF(s.calls, 0))::double precision as rows_per_call
  FROM pg_stat_statements s
  WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND s.userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
  AND s.calls > 0
  ORDER BY s.total_exec_time / NULLIF(s.calls, 0) DESC
  LIMIT 10;
END;
$$;

-- Function to get ticket resolution metrics
CREATE OR REPLACE FUNCTION get_ticket_resolution_metrics()
RETURNS TABLE (
  status text,
  avg_resolution_time_minutes double precision,
  ticket_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.status::text,
    COALESCE(
      AVG(
        CASE 
          WHEN t.updated_at IS NOT NULL AND t.created_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (t.updated_at - t.created_at))/60.0 
          ELSE NULL 
        END
      )::double precision,
      0.0
    ) as avg_resolution_time_minutes,
    COUNT(*)::bigint as ticket_count
  FROM tickets t
  WHERE t.status IS NOT NULL
  GROUP BY t.status;

  -- Return empty row if no tickets found
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      'no_tickets'::text,
      0.0::double precision,
      0::bigint;
  END IF;
END;
$$;

-- Function to get agent performance metrics
CREATE OR REPLACE FUNCTION get_agent_performance_metrics()
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  tickets_resolved bigint,
  avg_resolution_time_minutes double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as agent_id,
    COALESCE(p.full_name, 'Unknown') as agent_name,
    COUNT(t.id)::bigint as tickets_resolved,
    COALESCE(
      AVG(
        CASE 
          WHEN t.updated_at IS NOT NULL AND t.created_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (t.updated_at - t.created_at))/60.0
          ELSE NULL 
        END
      )::double precision,
      0.0
    ) as avg_resolution_time_minutes
  FROM profiles p
  LEFT JOIN tickets t ON t.assigned_to = p.id AND t.status = 'resolved'
  WHERE p.role = 'agent'
  GROUP BY p.id, p.full_name;

  -- Return empty row if no agents found
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::uuid,
      'No agents'::text,
      0::bigint,
      0.0::double precision;
  END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_database_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_query_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_resolution_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_performance_metrics() TO authenticated; 