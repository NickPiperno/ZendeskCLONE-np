import { supabase } from './supabase'
import type { CustomerTicket, TicketTimelineEvent, TicketSummary } from '@/modules/tickets/types/ticket.types'

class CustomerTicketService {
    /**
     * Get timeline for a specific ticket
     */
    async getTicketTimeline(ticketId: string): Promise<TicketTimelineEvent[]> {
        console.log('Fetching timeline for ticket:', ticketId)
        
        // First verify the ticket exists and user has access
        const { data: ticket, error: ticketError } = await supabase
            .from('customer_tickets')
            .select('*')
            .eq('id', ticketId)
            .single()

        if (ticketError) {
            console.error('Error fetching ticket:', ticketError)
            throw ticketError
        }

        if (!ticket) {
            console.error('Ticket not found or no access:', ticketId)
            throw new Error('Ticket not found or no access')
        }

        // Now fetch the timeline
        const { data, error } = await supabase
            .rpc('get_customer_ticket_timeline', {
                p_ticket_id: ticketId
            })

        if (error) {
            console.error('Error fetching timeline:', error)
            throw error
        }

        return data as TicketTimelineEvent[]
    }

    /**
     * Get ticket summary for the current user
     */
    async getTicketSummary(): Promise<TicketSummary[]> {
        const { data, error } = await supabase
            .rpc('get_customer_ticket_summary')

        if (error) throw error
        return data as TicketSummary[]
    }

    /**
     * Get customer's tickets with optional filters
     */
    async getTickets(filters?: {
        status?: string
        searchQuery?: string
        limit?: number
        offset?: number
    }) {
        let query = supabase
            .from('customer_tickets')
            .select('*')

        if (filters?.status) {
            query = query.eq('status', filters.status)
        }

        if (filters?.searchQuery) {
            query = query.ilike('title', `%${filters.searchQuery}%`)
        }

        if (filters?.limit) {
            query = query.limit(filters.limit)
        }

        if (filters?.offset) {
            query = query.range(
                filters.offset,
                filters.offset + (filters.limit || 10) - 1
            )
        }

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error
        return data as CustomerTicket[]
    }

    /**
     * Get notes for a specific ticket
     */
    async getTicketNotes(ticketId: string) {
        const { data, error } = await supabase
            .from('customer_ticket_notes')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true })

        if (error) throw error
        return data
    }

    /**
     * Add a note to a ticket
     */
    async addNote(ticketId: string, content: string) {
        const { error } = await supabase
            .from('ticket_notes')
            .insert({
                ticket_id: ticketId,
                content,
                is_internal: false
            })

        if (error) throw error
    }
}

export const customerTicketService = new CustomerTicketService() 