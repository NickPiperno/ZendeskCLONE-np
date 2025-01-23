import { useState } from 'react'
import { TicketService } from '@/services/tickets'
import type { TicketInsert } from '../types/ticket.types'
import { supabase } from '@/services/supabase'

/**
 * Hook for creating new tickets
 * Handles the submission process and loading/error states
 */
export function useCreateTicket() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createTicket(ticket: Omit<TicketInsert, 'created_at' | 'updated_at' | 'user_id'>) {
    try {
      setLoading(true)
      setError(null)

      const { data, error: serviceError } = await TicketService.createTicket(ticket)

      if (serviceError) {
        throw new Error(serviceError)
      }

      // Emit a broadcast event to trigger refetch in other components
      await supabase.channel('tickets-changes').send({
        type: 'broadcast',
        event: 'ticket-created',
        payload: {}
      })

      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create ticket'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    createTicket,
    loading,
    error
  }
} 