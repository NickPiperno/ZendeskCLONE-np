# Thread System API Structure

## API Client

### 1. Thread Management

```typescript
// Thread API Client
class ThreadAPI {
    // Create new thread
    static async createThread(ticketId: string, data: {
        title?: string
        initial_message: string
        thread_type: 'customer_initiated' | 'agent_initiated' | 'ai_initiated'
    }): Promise<Thread>

    // Get threads for ticket
    static async getThreads(ticketId: string, options?: {
        status?: 'open' | 'closed'
        thread_type?: string
        limit?: number
        offset?: number
    }): Promise<Thread[]>

    // Get single thread with notes
    static async getThread(threadId: string): Promise<Thread & {
        notes: ThreadNote[]
        ai_metadata: ThreadAIMetadata
    }>

    // Update thread
    static async updateThread(threadId: string, data: {
        title?: string
        status?: 'open' | 'closed'
    }): Promise<Thread>
}
```

### 2. Message Management

```typescript
// Message Management Methods
class ThreadAPI {
    // Add message to thread
    static async addMessage(threadId: string, data: {
        content: string
        parent_id?: string  // For replies
    }): Promise<ThreadNote & {
        ai_processing_status?: 'pending' | 'completed'
    }>
}
```

### 3. AI Integration

```typescript
// AI Integration Methods
class ThreadAPI {
    // Get AI metadata for thread
    static async getAIMetadata(threadId: string): Promise<ThreadAIMetadata>

    // Update AI metadata
    static async updateAIMetadata(threadId: string, metadata: ThreadAIMetadata): Promise<Thread>
}
```

## Service Layer

```typescript
// Thread Service
class ThreadService {
    // Database operations
    static async createThread(ticketId: string, data: CreateThreadInput): Promise<ServiceResponse<Thread>>
    static async getThreads(ticketId: string, options?: ThreadOptions): Promise<ServiceResponse<Thread[]>>
    static async getThread(threadId: string): Promise<ServiceResponse<Thread>>
    static async updateThread(threadId: string, data: UpdateThreadInput): Promise<ServiceResponse<Thread>>
    static async addMessage(threadId: string, data: CreateMessageInput): Promise<ServiceResponse<ThreadNote>>
}
```

## Real-time Integration

```typescript
// React Query + Supabase Realtime Integration
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
            .subscribe()

        return () => {
            channel.unsubscribe()
        }
    }, [options.ticketId, queryClient])
}
```

## Performance Optimizations

1. **Caching Strategy**
   - Use React Query for data caching
   - Implement optimistic updates
   - Cache invalidation on mutations

2. **Pagination**
   - Implement cursor-based pagination
   - Use efficient offset/limit queries
   - Cache page results

3. **Real-time Updates**
   - Use Supabase Realtime for database changes
   - Batch updates when possible
   - Handle reconnection automatically 