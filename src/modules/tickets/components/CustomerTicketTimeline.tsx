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

  if (!events?.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No timeline events found</p>
      </div>
    )
  }

  const getEventIcon = (type: string) => {
    switch (type) {
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

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
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
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
} 