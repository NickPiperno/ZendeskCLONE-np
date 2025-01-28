import { ThreadService } from '@/services/thread'
import { createThreadSchema, updateThreadSchema, createMessageSchema } from '@/modules/tickets/types/thread.types'

export class ThreadAPI {
    /**
     * Create a new thread
     */
    static async createThread(ticketId: string, data: {
        title?: string
        initial_message: string
        thread_type: 'customer_initiated' | 'agent_initiated' | 'ai_initiated'
    }) {
        const validatedData = createThreadSchema.parse(data)
        const { data: thread, error } = await ThreadService.createThread(ticketId, validatedData)

        if (error) {
            throw error
        }

        return thread
    }

    /**
     * Get threads for a ticket
     */
    static async getThreads(ticketId: string, options?: {
        status?: 'open' | 'closed'
        thread_type?: string
        limit?: number
        offset?: number
    }) {
        const { data: threads, error } = await ThreadService.getThreads(ticketId, options)

        if (error) {
            throw error
        }

        return threads
    }

    /**
     * Get a single thread
     */
    static async getThread(threadId: string) {
        const { data: thread, error } = await ThreadService.getThread(threadId)

        if (error) {
            throw error
        }

        return thread
    }

    /**
     * Update a thread
     */
    static async updateThread(threadId: string, data: {
        title?: string
        status?: 'open' | 'closed'
    }) {
        const validatedData = updateThreadSchema.parse(data)
        const { data: thread, error } = await ThreadService.updateThread(threadId, validatedData)

        if (error) {
            throw error
        }

        return thread
    }

    /**
     * Add a message to a thread
     */
    static async addMessage(threadId: string, data: {
        content: string
    }) {
        const validatedData = createMessageSchema.parse(data)
        const { data: message, error } = await ThreadService.addMessage(threadId, validatedData)

        if (error) {
            throw error
        }

        return message
    }
} 