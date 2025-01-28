import { useQuery } from '@tanstack/react-query'
import { customerTicketService } from '@/services/customer-tickets'
import { Card } from '@/ui/components/card'
import { Skeleton } from '@/ui/components/skeleton'
import type { TicketTimelineEvent } from '../types/ticket.types'

interface CustomerTicketTimelineProps {
  ticketId: string
}

export function CustomerTicketTimeline({ ticketId }: CustomerTicketTimelineProps) {
  const { data: events, isLoading } = useQuery<TicketTimelineEvent[]>({
    queryKey: ['ticketTimeline', ticketId],
    queryFn: () => customerTicketService.getTicketTimeline(ticketId),
    refetchOnWindowFocus: true,
    staleTime: 0 // Always fetch fresh data
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    )
  }

  // Filter out thread-related events
  const filteredEvents = events?.filter(event => 
    !['thread_created', 'message_added'].includes(event.event_type)
  )

  if (!filteredEvents?.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No timeline events found</p>
      </div>
    )
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'ticket_created':
        return '🎫'
      case 'status_change':
        return '🔄'
      case 'note_added':
        return '📝'
      case 'assignment_change':
        return '👤'
      default:
        return '•'
    }
  }

  const renderEventDetails = (event: TicketTimelineEvent) => {
    switch (event.event_type) {
      case 'ticket_created':
        return (
          <div className="mt-2 text-sm">
            {event.thread_context.description && (
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="font-medium text-sm">Initial Description:</p>
                <p className="whitespace-pre-wrap">{event.thread_context.description}</p>
              </div>
            )}
          </div>
        )
      case 'status_change':
        return (
          <div className="mt-2 text-sm text-muted-foreground">
            Previous status: {event.thread_context.old_status || 'None'}
          </div>
        )
      case 'assignment_change':
        return null // We already show a user-friendly message in event_description
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {filteredEvents.map((event, index) => (
        <Card key={index} className="p-4">
          <div className="flex items-start gap-4">
            <div className="text-2xl">
              {getEventIcon(event.event_type)}
            </div>
            <div className="flex-1">
              <p className="font-medium">{event.event_description}</p>
              <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                <span>By {event.actor_name}</span>
                <time>{new Date(event.event_time).toLocaleString()}</time>
              </div>
              {renderEventDetails(event)}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
} 