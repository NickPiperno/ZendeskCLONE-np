import { supabase } from './supabase'
import type { Thread, ThreadNote, ThreadAIMetadata } from '@/modules/tickets/types/thread.types'

// Error codes for better error tracking and handling
export const ThreadErrorCodes = {
    THREAD_NOT_FOUND: 'thread_not_found',
    INVALID_THREAD_TYPE: 'invalid_thread_type',
    UNAUTHORIZED: 'unauthorized',
    AI_PROCESSING_FAILED: 'ai_processing_failed',
    VALIDATION_ERROR: 'validation_error',
    CREATE_ERROR: 'create_error',
    UPDATE_ERROR: 'update_error',
    FETCH_ERROR: 'fetch_error'
} as const

type ThreadErrorCode = typeof ThreadErrorCodes[keyof typeof ThreadErrorCodes]

interface ThreadError {
    code: ThreadErrorCode
    message: string
    details?: unknown
}

export class ThreadService {
    /**
     * Create a new thread
     */
    static async createThread(ticketId: string, data: {
        title?: string
        initial_message: string
        thread_type: 'customer_initiated' | 'agent_initiated' | 'ai_initiated'
    }) {
        try {
            // Validate user session
            const { data: { user }, error: sessionError } = await supabase.auth.getUser()
            if (sessionError || !user) {
                throw {
                    code: ThreadErrorCodes.UNAUTHORIZED,
                    message: 'Authentication required to create thread'
                }
            }

            // Start transaction
            const { data: thread, error: threadError } = await supabase
                .from('ticket_threads')
                .insert([{
                    ticket_id: ticketId,
                    title: data.title,
                    thread_type: data.thread_type,
                    created_by: user.id,
                    ai_context: {
                        context_type: 'question',
                        priority_indicator: 0.5
                    }
                }])
                .select()
                .single()

            if (threadError) throw threadError

            // Create initial message
            const { error: noteError } = await supabase
                .from('ticket_notes')
                .insert([{
                    thread_id: thread.id,
                    ticket_id: ticketId,
                    content: data.initial_message,
                    created_by: user.id,
                    message_type: data.thread_type === 'ai_initiated' ? 'ai' : 
                                data.thread_type === 'agent_initiated' ? 'agent' : 'customer',
                    is_internal: false
                }])

            if (noteError) throw noteError

            return { data: thread as Thread, error: null }
        } catch (error) {
            console.error('Failed to create thread:', error)
            return {
                data: null,
                error: error as ThreadError
            }
        }
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
        try {
            let query = supabase
                .from('ticket_threads')
                .select(`
                    *,
                    created_by,
                    ticket_id,
                    status,
                    thread_type
                `)
                .eq('ticket_id', ticketId)
                .is('deleted', false)

            console.log('Building query for ticket:', {
                ticketId,
                options,
                table: 'ticket_threads',
                filters: {
                    ticket_id: ticketId,
                    deleted: false,
                    ...(options?.status && { status: options.status }),
                    ...(options?.thread_type && { thread_type: options.thread_type })
                }
            })

            if (options?.limit) {
                query = query.limit(options.limit)
            }

            if (options?.offset) {
                query = query.range(
                    options.offset,
                    options.offset + (options.limit || 10) - 1
                )
            }

            const { data, error } = await query.order('created_at', { ascending: false })

            if (error) throw error

            console.log('ThreadService.getThreads response:', {
                ticketId,
                options,
                data,
                error
            })

            return { data: data as Thread[], error: null }
        } catch (error) {
            console.error('Failed to fetch threads:', error)
            return {
                data: null,
                error: error as ThreadError
            }
        }
    }

    /**
     * Get a single thread with its messages
     */
    static async getThread(threadId: string) {
        try {
            // Get thread
            const { data: thread, error: threadError } = await supabase
                .from('ticket_threads')
                .select('*')
                .eq('id', threadId)
                .is('deleted', false)
                .single()

            if (threadError) throw threadError

            // Get messages
            const { data: notes, error: notesError } = await supabase
                .from('ticket_notes')
                .select(`
                    *,
                    profiles (
                        full_name,
                        role
                    )
                `)
                .eq('thread_id', threadId)
                .is('deleted', false)
                .order('created_at', { ascending: true })

            if (notesError) throw notesError

            return {
                data: {
                    ...thread,
                    notes: notes as ThreadNote[]
                } as Thread & { notes: ThreadNote[] },
                error: null
            }
        } catch (error) {
            console.error('Failed to fetch thread:', error)
            return {
                data: null,
                error: error as ThreadError
            }
        }
    }

    /**
     * Update thread status or title
     */
    static async updateThread(threadId: string, updates: {
        title?: string
        status?: 'open' | 'closed'
    }) {
        try {
            const { data, error } = await supabase
                .from('ticket_threads')
                .update(updates)
                .eq('id', threadId)
                .is('deleted', false)
                .select()
                .single()

            if (error) throw error

            return { data: data as Thread, error: null }
        } catch (error) {
            console.error('Failed to update thread:', error)
            return {
                data: null,
                error: error as ThreadError
            }
        }
    }

    /**
     * Add message to thread
     */
    static async addMessage(threadId: string, data: {
        content: string
        message_type: 'customer' | 'agent' | 'system' | 'ai'
    }) {
        try {
            const { data: { user }, error: sessionError } = await supabase.auth.getUser()
            if (sessionError || !user) {
                throw {
                    code: ThreadErrorCodes.UNAUTHORIZED,
                    message: 'Authentication required to add message'
                }
            }

            // Get thread first to get ticket_id
            const { data: thread, error: threadError } = await supabase
                .from('ticket_threads')
                .select('ticket_id, thread_type')
                .eq('id', threadId)
                .single()

            if (threadError) throw threadError

            // Create message
            const { data: note, error: noteError } = await supabase
                .from('ticket_notes')
                .insert([{
                    thread_id: threadId,
                    ticket_id: thread.ticket_id,
                    content: data.content,
                    created_by: user.id,
                    message_type: data.message_type,
                    is_internal: false
                }])
                .select(`
                    *,
                    profiles (
                        full_name,
                        role
                    )
                `)
                .single()

            if (noteError) throw noteError

            return { data: note as ThreadNote, error: null }
        } catch (error) {
            console.error('Failed to add message:', error)
            return {
                data: null,
                error: error as ThreadError
            }
        }
    }

    /**
     * Get AI metadata for thread
     */
    static async getAIMetadata(threadId: string) {
        try {
            const { data, error } = await supabase
                .from('ticket_threads')
                .select('ai_context')
                .eq('id', threadId)
                .single()

            if (error) throw error

            return { data: data.ai_context as ThreadAIMetadata, error: null }
        } catch (error) {
            console.error('Failed to fetch AI metadata:', error)
            return {
                data: null,
                error: error as ThreadError
            }
        }
    }

    /**
     * Update AI metadata for thread
     */
    static async updateAIMetadata(threadId: string, metadata: ThreadAIMetadata) {
        try {
            const { data, error } = await supabase
                .from('ticket_threads')
                .update({
                    ai_context: metadata
                })
                .eq('id', threadId)
                .select()
                .single()

            if (error) throw error

            return { data: data as Thread, error: null }
        } catch (error) {
            console.error('Failed to update AI metadata:', error)
            return {
                data: null,
                error: error as ThreadError
            }
        }
    }
} 