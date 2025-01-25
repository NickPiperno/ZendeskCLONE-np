/**
 * ThreadList.tsx
 * Displays a list of threads for a ticket.
 * Implements Modern Skeuomorphic design with card-based layout.
 */

import { useThreads } from '@/hooks/useThreads'
import type { Thread } from '../../types/thread.types'

interface ThreadListProps {
    ticketId: string
    className?: string
}

export function ThreadList({ ticketId, className = '' }: ThreadListProps) {
    const { threads, isLoading, isError: error } = useThreads({ ticketId })

    if (isLoading) {
        return (
            <div className="space-y-4">
                {/* Skeuomorphic loading skeleton */}
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="p-4 rounded-lg bg-gradient-to-b from-background to-muted/50
                                 shadow-md hover:shadow-lg transition-shadow duration-200
                                 animate-pulse"
                    >
                        <div className="h-6 w-3/4 bg-muted rounded mb-2"></div>
                        <div className="h-4 w-1/2 bg-muted rounded"></div>
                    </div>
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive
                          shadow-inner border border-destructive/20">
                Failed to load threads
            </div>
        )
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {threads?.map((thread) => (
                <ThreadCard key={thread.id} thread={thread} />
            ))}
        </div>
    )
}

interface ThreadCardProps {
    thread: Thread
}

function ThreadCard({ thread }: ThreadCardProps) {
    return (
        <div className="p-4 rounded-lg bg-gradient-to-b from-background to-muted/50
                      shadow-md hover:shadow-lg transition-all duration-200
                      border border-border/50 hover:border-border
                      transform hover:-translate-y-0.5">
            <h3 className="text-lg font-semibold mb-2">
                {thread.title || 'Untitled Thread'}
            </h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                <span className="capitalize">{thread.status}</span>
                <span className="capitalize">{thread.thread_type.replace('_', ' ')}</span>
            </div>
        </div>
    )
} 