-- Create function to calculate average response time
CREATE OR REPLACE FUNCTION calculate_avg_response_time()
RETURNS float
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  avg_minutes float;
BEGIN
  -- Calculate average time between ticket creation and first response
  SELECT AVG(EXTRACT(EPOCH FROM (first_response.created_at - t.created_at))/60)
  INTO avg_minutes
  FROM tickets t
  LEFT JOIN LATERAL (
    SELECT created_at
    FROM ticket_notes
    WHERE ticket_id = t.id
    AND user_id != t.user_id -- Exclude notes from ticket creator
    ORDER BY created_at ASC
    LIMIT 1
  ) first_response ON true
  WHERE first_response.created_at IS NOT NULL;

  RETURN COALESCE(avg_minutes, 0);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_avg_response_time() TO authenticated; 