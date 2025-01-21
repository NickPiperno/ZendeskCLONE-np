import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { TicketService } from '@/services/tickets'
import type { Ticket, TicketStatus, TicketPriority } from '../types/ticket.types'

interface UseTicketsFilters {
  status?: TicketStatus
  priority?: TicketPriority
}

/**
 * Hook for fetching and managing tickets
 * Supports filtering by status and priority
 * Includes real-time updates via Supabase
 */
export function useTickets(filters?: UseTicketsFilters) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchTickets() {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await TicketService.getTickets({
      status: filters?.status,
      priority: filters?.priority
    })

    setLoading(false)

    if (fetchError) {
      setError(fetchError)
      return
    }

    if (data) {
      setTickets(data)
    }
  }

  useEffect(() => {
    fetchTickets()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        async (payload) => {
          console.log('Real-time update:', payload)
          
          // Refetch to ensure we have the latest state with filters
          await fetchTickets()
        }
      )
      .on(
        'broadcast',
        { event: 'ticket-created' },
        async () => {
          console.log('Received ticket-created broadcast')
          await fetchTickets()
        }
      )
      .subscribe()

    // Cleanup subscription
    return () => {
      channel.unsubscribe()
    }
  }, [filters?.status, filters?.priority])

  return {
    tickets,
    loading,
    error,
    refetch: fetchTickets
  }
} 