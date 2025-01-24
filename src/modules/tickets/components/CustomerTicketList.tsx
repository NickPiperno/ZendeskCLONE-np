import { useQuery } from '@tanstack/react-query'
import { customerTicketService } from '@/services/customer-tickets'
import { Button } from '@/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card'
import { Badge } from '@/ui/components/badge'
import { Skeleton } from '@/ui/components/skeleton'
import type { CustomerTicket } from '../types/ticket.types'

interface CustomerTicketListProps {
  onTicketSelect: (ticketId: string) => void
}

export function CustomerTicketList({ onTicketSelect }: CustomerTicketListProps) {
  const { data: tickets, isLoading } = useQuery<CustomerTicket[]>({
    queryKey: ['customerTickets'],
    queryFn: () => customerTicketService.getTickets()
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  if (!tickets?.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No tickets found</p>
      </div>
    )
  }

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

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <Card key={ticket.id} className="hover:bg-accent/50 transition-colors">
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
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-muted-foreground">
                Created: {new Date(ticket.created_at).toLocaleDateString()}
                {ticket.has_agent && " • Assigned to agent"}
              </div>
              <Button variant="ghost" onClick={() => onTicketSelect(ticket.id)}>
                View Timeline
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
} 