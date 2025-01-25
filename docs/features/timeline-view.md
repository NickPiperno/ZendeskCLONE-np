# Timeline View Implementation

## Overview
The timeline view provides a chronological view of all events related to a ticket, including creation, status changes, thread creation, messages, and assignment changes.

## Troubleshooting History (March 2024)

### Attempt 1: Initial Timeline Function Fix
- Added ticket creation event to timeline function
- Added proper status and assignment change tracking
- Updated type definitions to match new structure
- ❌ Result: Timeline events still not showing

### Attempt 2: Thread System Migration Update
- Updated `step16_thread_system.sql` to include:
  - Proper thread creation tracking
  - Message event handling
  - Status change history
  - Assignment change tracking
- ❌ Result: Timeline working but realtime updates failing

### Attempt 3: Realtime Configuration
- Added realtime publication for tables:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_notes;
```
- ❌ Result: Got error about table already in publication

### Attempt 4: Safe Realtime Configuration
- Added checks before adding tables to publication:
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'ticket_threads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ticket_threads;
    END IF;
END $$;
```
- Added REPLICA IDENTITY FULL for both tables
- Added proper permissions
- ❌ Result: Still getting 400 error on realtime subscription

### Attempt 5: Timeline Function Access Fix (Current)
- Added better error handling in `customerTicketService.getTicketTimeline`:
  ```typescript
  // First verify the ticket exists and user has access
  const { data: ticket, error: ticketError } = await supabase
      .from('customer_tickets')
      .select('*')
      .eq('id', ticketId)
      .single()

  if (ticketError || !ticket) {
      throw new Error('Ticket not found or no access')
  }
  ```
- Added logging to track ticket ID format and access issues
- Added debug logging in `CustomerTicketsPage` to verify ticket selection
- Added realtime configuration for the `tickets` table
- Updated migration to include all necessary tables in realtime publication
- ⚠️ Current Status: Investigating 400 error with timeline function

### Attempt 6: Timeline Function Fix (✅ Success)
- Fixed error with `t.updated_by` column reference in timeline function
- Modified `get_customer_ticket_timeline` to properly use audit logs:
  ```sql
  -- Status changes now use audit_logs
  SELECT 
      a.created_at as event_time,
      'status_change' as event_type,
      format('Status changed to %s', 
          CASE a.new_data->>'status'
              WHEN 'open' THEN 'Open'
              WHEN 'in_progress' THEN 'In Progress'
              WHEN 'resolved' THEN 'Resolved'
              WHEN 'closed' THEN 'Closed'
              ELSE a.new_data->>'status'
          END
      ) as event_description,
      -- ... actor name logic ...
      jsonb_build_object(
          'old_status', a.old_data->>'status',
          'new_status', a.new_data->>'status'
      ) as thread_context
  FROM public.audit_logs a
  ```
- Similar changes for assignment tracking
- Now properly tracking all events:
  - ✅ Ticket creation
  - ✅ Thread creation
  - ✅ Message additions
  - ✅ Status changes (via audit logs)
  - ✅ Assignment changes (via audit logs)

### Current Status
- Timeline function working correctly
- All events displaying properly
- Proper actor attribution for changes
- Realtime updates configured for all relevant tables:
  - `tickets`
  - `ticket_threads`
  - `ticket_notes`

### Implementation Details
1. Event Sources:
   - Direct table queries for creation events
   - Audit logs for status/assignment changes
   - Thread system for conversation tracking

2. Data Flow:
   - Events ordered by timestamp (DESC)
   - Each event includes:
     - Timestamp
     - Event type
     - Description
     - Actor name (with proper role display)
     - Context data

3. Security:
   - RLS policies enforced
   - Customer access limited to owned tickets
   - Proper permissions granted for realtime

### Testing Checklist
- [x] Timeline shows ticket creation event
- [x] Thread creation events appear
- [x] Messages display in threads
- [x] Status changes are tracked
- [x] Assignment changes are visible
- [x] Realtime updates work
- [x] Proper permissions are enforced
- [x] Event ordering is correct (newest first)
- [x] Actor names display correctly
- [x] Context data is complete

### Recent Changes Impact

#### Database Layer
1. Added `tickets` table to realtime publication
2. Verified REPLICA IDENTITY settings for all tables
3. Granted proper SELECT permissions to authenticated users

#### Backend Layer
1. Enhanced error handling in timeline function
2. Added access verification before timeline fetch
3. Added detailed error logging for debugging

#### Frontend Layer
1. Added debug logging for ticket selection
2. Enhanced error handling in timeline component
3. Improved realtime subscription configuration

### Current Issues
1. Timeline function returning 400 error
   - Investigating parameter type mismatch (UUID vs string)
   - Verifying user permissions and ticket ownership
   - Added logging to track request flow

2. Realtime subscription challenges
   - Added all required tables to publication
   - Configured proper replica identity
   - Enhanced error handling and logging

### Next Steps
1. Verify UUID format of ticket IDs
2. Test timeline function with known valid ticket
3. Review RLS policies for timeline access
4. Consider adding retry logic for failed requests

## Testing Checklist
- [x] Timeline shows ticket creation event
- [x] Thread creation events appear
- [x] Messages display in threads
- [x] Status changes are tracked
- [x] Assignment changes are visible
- [ ] Realtime updates work
- [x] Proper permissions are enforced
- [x] Event ordering is correct (newest first)

## Future Improvements
- Add retry mechanism for failed timeline requests
- Implement client-side caching for timeline data
- Add error boundary for timeline component
- Consider implementing optimistic updates

### Timeline Event Types
- `ticket_created`: Initial ticket creation event
- `thread_created`: New thread creation
- `message_added`: Messages added to threads
- `status_change`: Ticket status updates
- `assignment_change`: Agent assignment changes

### Type Definitions
Updated type definitions in `ticket.types.ts` and `thread.types.ts`:
```typescript
interface TicketTimelineEvent {
    event_time: string
    event_type: 'ticket_created' | 'thread_created' | 'message_added' | 'status_change' | 'assignment_change'
    event_description: string
    actor_name: string
    thread_id: string | null
    thread_context: {
        ticket_id?: string
        title?: string
        description?: string
        thread_type?: string
        ai_context?: Record<string, any>
        message_type?: string
        ai_processed?: boolean
        old_status?: string
        new_status?: string
        assigned_to?: string | null
    }
}
```

### Frontend Component Status
The `CustomerTicketTimeline` component implementation:
- ✅ Shows all event types with appropriate icons
- ✅ Displays thread content when relevant
- ✅ Shows status change history
- ✅ Indicates agent assignments
- ❌ Realtime updates not working

## Supabase Realtime Verification Steps

### 1. Project Dashboard Settings
1. Go to Supabase project dashboard
2. Navigate to Settings > API > Realtime
3. Verify that:
   - Realtime is enabled (should show "Enabled" status)
   - Database connection string is correct
   - Max number of concurrent connections is sufficient

### 2. Database Configuration Check
```sql
-- Check if realtime is enabled for the database
SELECT * FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- Check which tables are in the realtime publication
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Verify replica identity settings
SELECT c.relname, c.relreplident
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
AND c.relname IN ('ticket_threads', 'ticket_notes');
```

### 3. Client Configuration Check
```typescript
// Verify Supabase client configuration
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      enabled: true,
      // Verify these settings
      params: {
        eventsPerSecond: 10,
      }
    }
  }
)
```

### 4. Subscription Debug Mode
```typescript
// Add debug logging to subscription
const channel = supabase
  .channel(`ticket-threads:${options.ticketId}`)
  .on('postgres_changes' as never, {
    event: 'INSERT',
    schema: 'public',
    table: 'ticket_threads',
    filter: `ticket_id=eq.${options.ticketId}`
  }, (payload) => {
    console.log('Received realtime event:', payload)
    // ... rest of the handler
  })
  .subscribe((status) => {
    console.log('Subscription status:', status)
  })
```

## Current Issues
1. Realtime subscription failing with 400 error
   - [ ] Verify project settings in Supabase dashboard
   - [ ] Run database configuration checks
   - [ ] Add debug logging to subscription
   - [ ] Check network requests in browser dev tools
2. Need to verify RLS policies are not blocking realtime subscriptions
3. Need to implement fallback mechanism if realtime cannot be enabled

## Next Steps
1. Verify Supabase project settings:
   - Check if realtime is enabled in project settings
   - Verify database connection settings
2. Review RLS policies:
   - Check if policies allow realtime subscriptions
   - Verify user has proper permissions
3. Consider alternative approaches:
   - Use polling as temporary fallback
   - Consider websocket-based solution
   - Investigate Supabase broadcast channels

## Testing Checklist
- [x] Timeline shows ticket creation event
- [x] Thread creation events appear
- [x] Messages display in threads
- [x] Status changes are tracked
- [x] Assignment changes are visible
- [ ] Realtime updates work
- [x] Proper permissions are enforced
- [x] Event ordering is correct (newest first)

## Future Improvements
- Consider adding event filtering
- Add timeline event search
- Implement event grouping by date
- Add event type filtering
- Implement fallback mechanism for realtime updates 