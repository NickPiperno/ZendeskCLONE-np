import { useState, useEffect } from 'react'
import { TicketNoteService } from '@/services/ticket-notes'
import { supabase } from '@/services/supabase'
import type { TicketNote } from '../types/ticket-note.types'

/**
 * Hook for managing ticket notes
 * Includes real-time updates via Supabase
 */
export function useTicketNotes(ticketId: string) {
  const [notes, setNotes] = useState<TicketNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchNotes() {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await TicketNoteService.getNotes(ticketId)

    setLoading(false)

    if (fetchError) {
      setError(fetchError)
      return
    }

    if (data) {
      setNotes(data)
    }
  }

  useEffect(() => {
    fetchNotes()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('ticket-notes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_notes',
          filter: `ticket_id=eq.${ticketId}`
        },
        async (payload) => {
          console.log('Real-time note update:', payload)
          
          // Refetch to ensure we have the latest state
          await fetchNotes()
        }
      )
      .subscribe()

    // Cleanup subscription
    return () => {
      channel.unsubscribe()
    }
  }, [ticketId])

  return {
    notes,
    loading,
    error,
    refetch: fetchNotes
  }
} 