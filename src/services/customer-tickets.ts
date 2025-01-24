import { supabase } from './supabase'

interface TicketTimelineEvent {
    event_time: string
    event_type: 'status_change' | 'note_added' | 'assignment_change'
    event_description: string
    actor_name: string
}

interface TicketSummary {
    status: string
    count: number
    last_update: string
}

/**
 * Customer ticket service for handling customer-specific ticket operations
 */
export const customerTicketService = {
    /**
     * Get timeline for a specific ticket
     */
    async getTicketTimeline(ticketId: string): Promise<TicketTimelineEvent[]> {
        const { data, error } = await supabase
            .rpc('get_customer_ticket_timeline', {
                p_ticket_id: ticketId
            })

        if (error) throw error
        return data
    },

    /**
     * Get ticket summary for the current user
     */
    async getTicketSummary(): Promise<TicketSummary[]> {
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) throw new Error('User not authenticated')

        const { data, error } = await supabase
            .rpc('get_customer_ticket_summary', {
                p_user_id: user.id
            })

        if (error) throw error
        return data
    },

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
        return data
    },

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
    },

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