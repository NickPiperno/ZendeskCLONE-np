import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { TicketService } from '@/services/tickets'
import type { Ticket, TicketStatus, TicketPriority } from '../types/ticket.types'
import { useQueryClient } from '@tanstack/react-query'

interface UseTicketsFilters {
  status?: TicketStatus
  priority?: TicketPriority
  assignedTo?: string | true | null  // string = specific agent, true = any agent, null = unassigned
}

/**
 * Hook for fetching and managing tickets
 * Supports filtering by:
 * - Status
 * - Priority
 * - Assignment (unassigned, specific agent, or any agent)
 * Includes real-time updates via Supabase
 */
export function useTickets(filters?: UseTicketsFilters) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  async function fetchTickets() {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await TicketService.getTickets({
      status: filters?.status,
      priority: filters?.priority,
      assignedTo: filters?.assignedTo
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
          
          // Handle the update based on the event type
          if (payload.eventType === 'INSERT') {
            setTickets(prev => [payload.new as Ticket, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setTickets(prev => prev.map(ticket => 
              ticket.id === payload.new.id ? payload.new as Ticket : ticket
            ))
          } else if (payload.eventType === 'DELETE') {
            setTickets(prev => prev.filter(ticket => ticket.id !== payload.old.id))
          }

          // Also invalidate the query cache
          queryClient.invalidateQueries({ queryKey: ['tickets'] })
        }
      )
      .subscribe()

    // Cleanup subscription
    return () => {
      channel.unsubscribe()
    }
  }, [filters?.status, filters?.priority, filters?.assignedTo])

  return {
    tickets,
    loading,
    error,
    refetch: fetchTickets
  }
} 