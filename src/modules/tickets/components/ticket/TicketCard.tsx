import { Badge } from '@/ui/components/badge'
import { Button } from '@/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card'
import { useThreads } from '@/hooks/useThreads'
import type { CustomerTicket } from '../../types/ticket.types'

interface TicketCardProps {
  ticket: CustomerTicket
  onSelect: (ticketId: string) => void
}

export function TicketCard({ ticket, onSelect }: TicketCardProps) {
  const { threads, isLoading: threadsLoading } = useThreads({ ticketId: ticket.id })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500'
      case 'in_progress':
        return 'bg-yellow-500'
      case 'resolved':
        return 'bg-green-500'
      case 'closed':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getLatestThread = () => {
    if (!threads?.length) return null
    return threads.reduce((latest, thread) => {
      return new Date(thread.updated_at) > new Date(latest.updated_at) ? thread : latest
    })
  }

  const latestThread = getLatestThread()

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground">#{ticket.id.split('-')[0]}</span>
            <CardTitle className="text-lg">{ticket.title}</CardTitle>
          </div>
          <Badge className={getStatusColor(ticket.status)}>
            {ticket.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {ticket.description}
        </p>
        
        {/* Thread Preview */}
        <div className="mt-4 space-y-2">
          {threadsLoading ? (
            <div className="h-6 w-3/4 bg-muted animate-pulse rounded"></div>
          ) : threads?.length ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {threads.length} Thread{threads.length === 1 ? '' : 's'}
                </span>
                {latestThread && (
                  <span className="text-xs">
                    Latest update: {new Date(latestThread.updated_at).toLocaleString()}
                  </span>
                )}
              </div>
              {latestThread && (
                <div className="p-2 rounded bg-muted/30 text-sm">
                  <span className="font-medium">{latestThread.title || 'Untitled Thread'}</span>
                  <span className="mx-2">•</span>
                  <span className="text-muted-foreground capitalize">{latestThread.status}</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-muted-foreground">
            Created: {new Date(ticket.created_at).toLocaleDateString()}
            {ticket.has_agent && " • Assigned to agent"}
          </div>
          <Button variant="ghost" onClick={() => onSelect(ticket.id)}>
            View Timeline
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 