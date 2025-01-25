-- Add indexes to optimize common ticket queries
CREATE INDEX IF NOT EXISTS idx_tickets_status 
ON public.tickets(status) 
WHERE NOT deleted;

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to 
ON public.tickets(assigned_to) 
WHERE NOT deleted;

CREATE INDEX IF NOT EXISTS idx_tickets_created_at 
ON public.tickets(created_at DESC) 
WHERE NOT deleted;

-- Composite index for queries that combine status and assignment
CREATE INDEX IF NOT EXISTS idx_tickets_status_assigned 
ON public.tickets(status, assigned_to) 
WHERE NOT deleted;

-- Index for unassigned tickets
CREATE INDEX IF NOT EXISTS idx_tickets_unassigned
ON public.tickets((1))
WHERE assigned_to IS NULL AND NOT deleted;

COMMENT ON INDEX public.idx_tickets_status IS 'Optimizes filtering by ticket status';
COMMENT ON INDEX public.idx_tickets_assigned_to IS 'Optimizes filtering by assigned agent';
COMMENT ON INDEX public.idx_tickets_created_at IS 'Optimizes sorting by creation date';
COMMENT ON INDEX public.idx_tickets_status_assigned IS 'Optimizes combined status and assignment filtering';
COMMENT ON INDEX public.idx_tickets_unassigned IS 'Optimizes filtering for unassigned tickets'; 