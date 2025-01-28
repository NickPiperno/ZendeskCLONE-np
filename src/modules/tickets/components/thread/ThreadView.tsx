/**
 * ThreadView.tsx
 * Displays a thread's messages in a conversation layout and handles message composition.
 * Implements Modern Skeuomorphic design with message grouping and access control.
 */

import { useThread, useThreads } from '@/hooks/useThreads'
import { Skeleton } from '@/ui/components/skeleton'
import { Alert } from '@/ui/components/alert'
import { MessageComposer } from './MessageComposer'
import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'

interface ThreadViewProps {
    ticketId: string
    threadId?: string // Optional because we might need to fetch it from ticketId
    className?: string
    hideComposer?: boolean // For timeline view where we don't want the composer
}

interface UserInfo {
    full_name: string
    role: string
}

export function ThreadView({ ticketId, threadId: providedThreadId, className = '', hideComposer = false }: ThreadViewProps) {
    const [noAccessError, setNoAccessError] = useState(false)
    const [userInfo, setUserInfo] = useState<Record<string, UserInfo>>({})
    const { threads } = useThreads({ ticketId })
    const existingThread = threads?.find(t => !t.deleted)
    const threadId = providedThreadId || existingThread?.id

    const { data: thread, isLoading, isError, error } = useThread(threadId || '')

    useEffect(() => {
        // Check if user has access to this ticket
        async function checkAccess() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setNoAccessError(true)
                return
            }

            // Get user's profile to check role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            // Get ticket details
            const { data: ticket } = await supabase
                .from('tickets')
                .select('user_id, assigned_to')
                .eq('id', ticketId)
                .single()
            
            // Allow access if user is:
            // 1. The customer who owns the ticket
            // 2. The agent assigned to the ticket
            // 3. An admin
            const hasAccess = ticket && (
                ticket.user_id === user.id || // Customer access
                ticket.assigned_to === user.id || // Agent access
                profile?.role === 'admin' // Admin access
            )

            if (!hasAccess) {
                setNoAccessError(true)
            }
        }

        checkAccess()
    }, [ticketId])

    // Fetch user information for all messages
    useEffect(() => {
        async function fetchUserInfo() {
            if (!thread?.notes) return

            const userIds = [...new Set(thread.notes.map(note => note.created_by))]
            
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .in('id', userIds)

            if (profiles) {
                const userInfoMap: Record<string, UserInfo> = {}
                profiles.forEach(profile => {
                    userInfoMap[profile.id] = {
                        full_name: profile.full_name,
                        role: profile.role
                    }
                })
                setUserInfo(userInfoMap)
            }
        }

        fetchUserInfo()
    }, [thread?.notes])

    if (noAccessError) {
        return (
            <Alert variant="destructive">
                <h3 className="font-semibold mb-2">Access Denied</h3>
                <p>You need to be assigned to this ticket to view its threads.</p>
            </Alert>
        )
    }

    if (isLoading) {
        return <Skeleton className="h-48 w-full" />
    }

    if (isError) {
        return (
            <Alert variant="destructive">
                {error?.message || 'Failed to load thread'}
            </Alert>
        )
    }

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin':
                return 'Admin'
            case 'agent':
                return 'Support Agent'
            default:
                return 'Customer'
        }
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {thread ? (
                <div className="space-y-4">
                    {thread.notes?.map((note) => (
                        <div key={note.id} className="rounded-lg bg-white p-4 shadow">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                        {userInfo[note.created_by]?.full_name || 'Unknown User'}
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                                        {getRoleLabel(userInfo[note.created_by]?.role || 'customer')}
                                    </span>
                                </div>
                                <span className="text-sm text-gray-500">
                                    {new Date(note.created_at).toLocaleString()}
                                </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap">{note.content}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-8">
                    No thread started yet
                </div>
            )}

            {!hideComposer && (
                <div className="mt-6">
                    <MessageComposer 
                        ticketId={ticketId}
                        threadId={threadId}
                        placeholder={thread ? "Reply to this thread..." : "Start a new thread..."}
                    />
                </div>
            )}
        </div>
    )
} 