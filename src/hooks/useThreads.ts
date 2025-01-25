import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { threadKeys } from '@/lib/react-query'
import { ThreadAPI } from '@/api/threads'
import { supabase } from '@/services/supabase'
import { useEffect } from 'react'
import type { 
    Thread, 
    ThreadNote,
    ThreadType,
    ThreadStatus,
    createThreadSchema,
    updateThreadSchema,
    createMessageSchema
} from '@/modules/tickets/types/thread.types'
import { z } from 'zod'

interface UseThreadsOptions {
    ticketId?: string
    status?: ThreadStatus
    threadType?: ThreadType
    [key: string]: unknown
}

type CreateThreadVars = z.infer<typeof createThreadSchema> & { ticketId: string }
type UpdateThreadVars = z.infer<typeof updateThreadSchema> & { threadId: string }
type CreateMessageVars = z.infer<typeof createMessageSchema> & { threadId: string }

interface RealtimeThreadPayload {
    new: Thread
    old: Thread
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
}

interface RealtimeNotePayload {
    new: ThreadNote
    old: ThreadNote
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
}

export function useThread(threadId: string) {
    return useQuery({
        queryKey: threadKeys.detail(threadId),
        queryFn: () => ThreadAPI.getThread(threadId),
        enabled: !!threadId,
    })
}

export function useThreads(options: UseThreadsOptions = {}) {
    const queryClient = useQueryClient()

    // Set up real-time subscriptions
    useEffect(() => {
        if (!options.ticketId) return

        console.log('Setting up realtime subscription for ticket:', options.ticketId)

        // Subscribe to all relevant changes
        const channel = supabase
            .channel(`ticket-updates:${options.ticketId}`, {
                config: {
                    broadcast: { self: true },
                    presence: { key: options.ticketId }
                }
            })
            // Listen for ticket changes
            .on('postgres_changes' as never, {
                event: '*',
                schema: 'public',
                table: 'tickets',
                filter: `id=eq.${options.ticketId}`
            }, (payload) => {
                console.log('Received ticket change:', payload)
                queryClient.invalidateQueries({
                    queryKey: threadKeys.list(options)
                })
            })
            // Listen for thread changes
            .on('postgres_changes' as never, {
                event: '*',
                schema: 'public',
                table: 'ticket_threads',
                filter: `ticket_id=eq.${options.ticketId}`
            }, (payload: RealtimeThreadPayload) => {
                console.log('Received thread change:', payload)
                queryClient.invalidateQueries({
                    queryKey: threadKeys.list(options)
                })
            })
            // Listen for note changes
            .on('postgres_changes' as never, {
                event: '*',
                schema: 'public',
                table: 'ticket_notes',
                filter: `ticket_id=eq.${options.ticketId}`
            }, (payload: RealtimeNotePayload) => {
                console.log('Received note change:', payload)
                queryClient.invalidateQueries({
                    queryKey: threadKeys.list(options)
                })
            })

        // Initial subscription
        channel.subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('Successfully subscribed to realtime events')
            } else if (err) {
                console.error('Subscription error:', status, err)
            }
        })

        // Cleanup subscription
        return () => {
            console.log('Cleaning up realtime subscription')
            channel.unsubscribe()
        }
    }, [options.ticketId, queryClient])

    // Query for fetching threads
    const threadsQuery = useQuery({
        queryKey: threadKeys.list(options),
        queryFn: async () => {
            if (!options.ticketId) throw new Error('Ticket ID is required')
            return ThreadAPI.getThreads(options.ticketId, options)
        },
        enabled: !!options.ticketId,
    })

    // Mutation for creating a new thread
    const createThread: UseMutationResult<Thread, Error, CreateThreadVars> = useMutation({
        mutationFn: async ({ ticketId, ...data }: CreateThreadVars) => {
            return await ThreadAPI.createThread(ticketId, data)
        },
        onSuccess: (newThread: Thread) => {
            queryClient.setQueryData<Thread[]>(
                threadKeys.list(options),
                (old = []) => [...old, newThread]
            )
        },
    })

    // Mutation for updating a thread
    const updateThread: UseMutationResult<Thread, Error, UpdateThreadVars> = useMutation({
        mutationFn: async ({ threadId, ...data }: UpdateThreadVars) => {
            return await ThreadAPI.updateThread(threadId, data)
        },
        onSuccess: (updatedThread: Thread) => {
            queryClient.setQueryData<Thread[]>(
                threadKeys.list(options),
                (old = []) => old.map(thread => 
                    thread.id === updatedThread.id ? updatedThread : thread
                )
            )
        },
    })

    // Mutation for adding a message
    const addMessage: UseMutationResult<ThreadNote, Error, CreateMessageVars> = useMutation({
        mutationFn: async ({ threadId, ...data }: CreateMessageVars) => {
            return await ThreadAPI.addMessage(threadId, data)
        },
        onSuccess: (newMessage: ThreadNote, variables: CreateMessageVars) => {
            // Update thread messages in cache
            queryClient.setQueryData<Thread & { notes: ThreadNote[] }>(
                threadKeys.detail(variables.threadId),
                (old) => old ? {
                    ...old,
                    notes: [...(old.notes || []), newMessage]
                } : undefined
            )
        },
    })

    return {
        threads: threadsQuery.data || [],
        isLoading: threadsQuery.isLoading,
        isError: threadsQuery.isError,
        error: threadsQuery.error,
        createThread,
        updateThread,
        addMessage,
    }
} 