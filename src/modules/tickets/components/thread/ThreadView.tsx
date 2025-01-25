/**
 * ThreadView.tsx
 * Displays a single thread's messages in a conversation layout.
 * Implements Modern Skeuomorphic design with message grouping and AI status indicators.
 */

import { useThread } from '@/hooks/useThreads'
import { MessageComposer } from './MessageComposer'
import { Skeleton } from '@/ui/components/skeleton'
import { Alert } from '@/ui/components/alert'

interface ThreadViewProps {
    threadId: string
    ticketId: string
}

export function ThreadView({ threadId, ticketId }: ThreadViewProps) {
    const { data: thread, isLoading, isError, error } = useThread(threadId)

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

    if (!thread) {
        return (
            <Alert variant="default">
                Thread not found
            </Alert>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{thread.title}</h3>
                <span className="text-sm text-gray-500">
                    {new Date(thread.created_at).toLocaleString()}
                </span>
            </div>

            <div className="space-y-4">
                {thread.notes?.map((note) => (
                    <div key={note.id} className="rounded-lg bg-white p-4 shadow">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">{note.created_by}</span>
                            <span className="text-sm text-gray-500">
                                {new Date(note.created_at).toLocaleString()}
                            </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap">{note.content}</p>
                    </div>
                ))}
            </div>

            <MessageComposer ticketId={ticketId} threadId={threadId} />
        </div>
    )
} 