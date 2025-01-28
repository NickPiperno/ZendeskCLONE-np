import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { Navigate } from 'react-router-dom'
import { customerTicketService } from '@/services/customer-tickets'
import { useQuery } from '@tanstack/react-query'
import { CustomerTicketList } from '../components/CustomerTicketList'
import { CustomerTicketDetail } from '../components/CustomerTicketDetail'
import type { CustomerTicket } from '../types/ticket.types'

export function CustomerTicketsPage() {
  const { profile } = useAuth()
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  // Redirect admin/agent users to admin tickets page
  if (profile?.role === 'admin' || profile?.role === 'agent') {
    return <Navigate to="/tickets" replace />
  }

  const { data: tickets } = useQuery<CustomerTicket[]>({
    queryKey: ['customerTickets'],
    queryFn: () => customerTicketService.getTickets()
  })

  const selectedTicket = tickets?.find(ticket => ticket.id === selectedTicketId)

  const handleTicketSelect = (ticketId: string) => {
    setSelectedTicketId(ticketId)
  }

  const handleBack = () => {
    setSelectedTicketId(null)
  }

  return (
    <div className="container py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Support Tickets</h1>
        <p className="text-muted-foreground">View and manage your support requests</p>
      </div>

      {selectedTicket ? (
        <CustomerTicketDetail 
          ticket={selectedTicket} 
          onBack={handleBack} 
        />
      ) : (
        <CustomerTicketList onTicketSelect={handleTicketSelect} />
      )}
    </div>
  )
} 