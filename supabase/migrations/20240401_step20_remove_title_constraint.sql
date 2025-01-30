-- Drop the unique constraint on title and user_id
ALTER TABLE public.tickets DROP CONSTRAINT tickets_title_user_id_key;

-- Add comment explaining why this was removed
COMMENT ON TABLE public.tickets IS 'Tickets table - Note: title uniqueness constraint was removed to allow users to create multiple tickets with the same title'; 