# Thread System Real-time Architecture

## Supabase Realtime Events

### Event Types

1. Thread Changes
```typescript
interface ThreadRealtimePayload {
    new: Thread
    old: Thread | null
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
}
```

2. Note Changes
```typescript
interface NoteRealtimePayload {
    new: ThreadNote
    old: ThreadNote | null
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
}
```

3. AI Processing Status
```typescript
interface AIProcessingPayload {
    threadId: string
    status: 'started' | 'processing' | 'completed' | 'failed'
    progress?: number
    error?: string
}
```

## Client Implementation

### React Query Integration
```typescript
function useThreadUpdates(options: UseThreadsOptions) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!options.ticketId) return

        // Subscribe to thread changes
        const channel = supabase
            .channel(`ticket-threads:${options.ticketId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'ticket_threads',
                filter: `ticket_id=eq.${options.ticketId}`
            }, (payload) => {
                queryClient.invalidateQueries({
                    queryKey: threadKeys.list(options)
                })
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'ticket_notes',
                filter: `ticket_id=eq.${options.ticketId}`
            }, (payload) => {
                if (payload.new?.thread_id) {
                    queryClient.invalidateQueries({
                        queryKey: threadKeys.detail(payload.new.thread_id)
                    })
                }
            })
            .subscribe()

        return () => {
            channel.unsubscribe()
        }
    }, [options.ticketId, queryClient])
}
```

## Performance Considerations

1. **Message Batching**
   - Use React Query's mutation batching
   - Debounce rapid state updates
   - Batch AI status updates

2. **Connection Management**
   - Leverage Supabase's built-in reconnection
   - Handle offline state with React Query
   - Queue updates during disconnection

3. **State Synchronization**
   - Use React Query for cache management
   - Implement optimistic updates
   - Handle concurrent modifications

## Security Measures

1. **Authentication**
   - Use Supabase auth integration
   - Validate channel subscriptions
   - Enforce RLS policies

2. **Rate Limiting**
   - Use Supabase's rate limiting
   - Monitor connection usage
   - Implement client-side throttling

3. **Data Validation**
   - Validate payloads with Zod
   - Sanitize message content
   - Verify event types 