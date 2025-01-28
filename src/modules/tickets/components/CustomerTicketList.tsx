import { useQuery } from '@tanstack/react-query'
import { customerTicketService } from '@/services/customer-tickets'
import { Skeleton } from '@/ui/components/skeleton'
import type { CustomerTicket } from '../types/ticket.types'
import { TicketCard } from './TicketCard'

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

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <TicketCard 
          key={ticket.id} 
          ticket={ticket} 
          onSelect={onTicketSelect} 
        />
      ))}
    </div>
  )
} 