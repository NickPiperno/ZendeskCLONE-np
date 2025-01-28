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
    }): Promise<ThreadNote & {
        ai_processing_status?: 'pending' | 'completed'
    }>
}
```