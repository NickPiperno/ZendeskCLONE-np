import { supabase } from './supabase'
import type { Ticket, TicketInsert, TicketUpdate } from '@/modules/tickets/types/ticket.types'

// Error codes for better error tracking and handling
export const TicketErrorCodes = {
  UNAUTHORIZED: 'TICKET_UNAUTHORIZED',
  VALIDATION_ERROR: 'TICKET_VALIDATION_ERROR',
  NOT_FOUND: 'TICKET_NOT_FOUND',
  CREATE_ERROR: 'TICKET_CREATE_ERROR',
  UPDATE_ERROR: 'TICKET_UPDATE_ERROR',
  DELETE_ERROR: 'TICKET_DELETE_ERROR',
  FETCH_ERROR: 'TICKET_FETCH_ERROR',
  SKILL_ERROR: 'TICKET_SKILL_ERROR',
  ASSIGNMENT_ERROR: 'TICKET_ASSIGNMENT_ERROR'
} as const

type TicketErrorCode = typeof TicketErrorCodes[keyof typeof TicketErrorCodes]

interface TicketError {
  code?: TicketErrorCode
  message: string
  details?: unknown
}

interface TicketSkill {
  id: string
  ticket_id: string
  skill_id: string
  required_proficiency: number
}

interface AgentMatch {
  agent_id: string
  match_score: number
  reason: string
}

/**
 * Service class for handling ticket operations
 * Includes error handling and logging
 */
export class TicketService {
  /**
   * Validate ticket data before operations
   */
  private static validateTicket(ticket: Partial<TicketInsert>) {
    const errors: string[] = []

    if (!ticket.title?.trim()) {
      errors.push('Title is required')
    } else if (ticket.title.length > 255) {
      errors.push('Title must be less than 255 characters')
    }

    if (!ticket.description?.trim()) {
      errors.push('Description is required')
    }

    if (ticket.priority && !['low', 'medium', 'high', 'urgent'].includes(ticket.priority)) {
      errors.push('Invalid priority level')
    }

    if (ticket.status && !['open', 'in_progress', 'resolved', 'closed'].includes(ticket.status)) {
      errors.push('Invalid status')
    }

    return errors
  }

  /**
   * Create a new ticket
   */
  static async createTicket(ticket: Omit<TicketInsert, 'created_at' | 'updated_at' | 'user_id'>) {
    try {
      // Validate user session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError) {
        throw {
          code: TicketErrorCodes.UNAUTHORIZED,
          message: 'Authentication required',
          details: sessionError
        }
      }
      if (!user) {
        throw {
          code: TicketErrorCodes.UNAUTHORIZED,
          message: 'You must be logged in to create a ticket'
        }
      }

      // Validate ticket data
      const validationErrors = this.validateTicket(ticket)
      if (validationErrors.length > 0) {
        throw {
          code: TicketErrorCodes.VALIDATION_ERROR,
          message: 'Invalid ticket data',
          details: validationErrors
        }
      }

      console.log('Creating ticket:', { ...ticket, description: '...' })
      
      const { data, error } = await supabase
        .from('tickets')
        .insert([{
          ...ticket,
          user_id: user.id,
          status: ticket.status || 'open',
          priority: ticket.priority || 'medium'
        }])
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw {
          code: TicketErrorCodes.CREATE_ERROR,
          message: 'Failed to create ticket',
          details: error
        }
      }

      console.log('Ticket created successfully:', data.id)
      return { data: data as Ticket, error: null }
    } catch (error) {
      const ticketError = error as TicketError
      console.error('Failed to create ticket:', {
        code: ticketError.code || TicketErrorCodes.CREATE_ERROR,
        message: ticketError.message,
        details: ticketError.details
      })
      
      return { 
        data: null, 
        error: ticketError.message || 'An unexpected error occurred while creating the ticket'
      }
    }
  }

  /**
   * Fetch tickets with optional filters
   */
  static async getTickets(options?: {
    assignedTo?: string | true | null  // string = specific agent, true = any agent, null = unassigned
    status?: Ticket['status']
    priority?: Ticket['priority']
    limit?: number
  }) {
    try {
      // Validate user session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !user) {
        throw {
          code: TicketErrorCodes.UNAUTHORIZED,
          message: 'Authentication required to fetch tickets',
          details: sessionError
        }
      }

      console.log('Fetching tickets with options:', options)

      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      // Handle assignment filters
      if (options?.assignedTo === null) {
        // Unassigned tickets
        query = query.is('assigned_to', null)
      } else if (options?.assignedTo === true) {
        // Any assigned tickets
        query = query.not('assigned_to', 'is', null)
      } else if (options?.assignedTo) {
        // Specific agent
        query = query.eq('assigned_to', options.assignedTo)
      }

      if (options?.status) {
        query = query.eq('status', options.status)
      }
      if (options?.priority) {
        query = query.eq('priority', options.priority)
      }
      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('Supabase error:', error)
        throw {
          code: TicketErrorCodes.FETCH_ERROR,
          message: 'Failed to fetch tickets',
          details: error
        }
      }

      console.log(`Successfully fetched ${data?.length || 0} tickets`)
      return { data: data as Ticket[], error: null }
    } catch (error) {
      const ticketError = error as TicketError
      console.error('Failed to fetch tickets:', {
        code: ticketError.code || TicketErrorCodes.FETCH_ERROR,
        message: ticketError.message,
        details: ticketError.details
      })
      
      return { 
        data: null, 
        error: ticketError.message || 'An unexpected error occurred while fetching tickets'
      }
    }
  }

  /**
   * Update an existing ticket
   */
  static async updateTicket(id: string, updates: TicketUpdate) {
    try {
      // Validate user session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !user) {
        throw {
          code: TicketErrorCodes.UNAUTHORIZED,
          message: 'Authentication required to update ticket',
          details: sessionError
        }
      }

      // Validate ticket data
      const validationErrors = this.validateTicket(updates)
      if (validationErrors.length > 0) {
        throw {
          code: TicketErrorCodes.VALIDATION_ERROR,
          message: 'Invalid ticket data',
          details: validationErrors
        }
      }

      console.log('Updating ticket:', id, updates)

      const { data, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw {
          code: TicketErrorCodes.UPDATE_ERROR,
          message: 'Failed to update ticket',
          details: error
        }
      }

      console.log('Ticket updated successfully:', id)
      return { data: data as Ticket, error: null }
    } catch (error) {
      const ticketError = error as TicketError
      console.error('Failed to update ticket:', {
        code: ticketError.code || TicketErrorCodes.UPDATE_ERROR,
        message: ticketError.message,
        details: ticketError.details
      })
      
      return { 
        data: null, 
        error: ticketError.message || 'An unexpected error occurred while updating the ticket'
      }
    }
  }

  /**
   * Delete a ticket (soft delete)
   */
  static async deleteTicket(id: string) {
    try {
      // Validate user session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !user) {
        throw {
          code: TicketErrorCodes.UNAUTHORIZED,
          message: 'Authentication required to delete ticket',
          details: sessionError
        }
      }

      console.log('Soft deleting ticket:', id)

      const { error } = await supabase
        .rpc('soft_delete_ticket', { ticket_id: id })

      if (error) {
        console.error('Supabase error:', error)
        throw {
          code: TicketErrorCodes.DELETE_ERROR,
          message: error.message || 'Failed to delete ticket',
          details: error
        }
      }

      console.log('Ticket soft deleted successfully:', id)
      return { error: null }
    } catch (error) {
      const ticketError = error as TicketError
      console.error('Failed to delete ticket:', ticketError)
      return { 
        error: ticketError.message || 'An unexpected error occurred while deleting the ticket'
      }
    }
  }

  /**
   * Add required skills to a ticket
   */
  static async addTicketSkills(ticketId: string, skills: { skillId: string, requiredProficiency: number }[]): Promise<TicketSkill[] | TicketError> {
    try {
      const { data, error } = await supabase
        .from('ticket_skills')
        .insert(
          skills.map(skill => ({
            ticket_id: ticketId,
            skill_id: skill.skillId,
            required_proficiency: skill.requiredProficiency
          }))
        )
        .select()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding ticket skills:', error)
      return {
        code: TicketErrorCodes.SKILL_ERROR,
        message: 'Failed to add ticket skills',
        details: error
      }
    }
  }

  /**
   * Get required skills for a ticket
   */
  static async getTicketSkills(ticketId: string): Promise<TicketSkill[] | TicketError> {
    try {
      const { data, error } = await supabase
        .from('ticket_skills')
        .select('*')
        .eq('ticket_id', ticketId)

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting ticket skills:', error)
      return {
        code: TicketErrorCodes.SKILL_ERROR,
        message: 'Failed to get ticket skills',
        details: error
      }
    }
  }

  /**
   * Find best agent match for a ticket
   */
  static async findBestAgentMatch(ticketId: string): Promise<AgentMatch[] | TicketError> {
    try {
      const { data, error } = await supabase
        .rpc('find_best_agent_match', { ticket_id: ticketId })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding agent match:', error)
      return {
        code: TicketErrorCodes.ASSIGNMENT_ERROR,
        message: 'Failed to find agent match',
        details: error
      }
    }
  }

  /**
   * Automatically assign ticket to best matching agent
   */
  static async autoAssignTicket(ticketId: string): Promise<string | TicketError> {
    try {
      const { data, error } = await supabase
        .rpc('auto_assign_ticket', { ticket_id: ticketId })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error auto-assigning ticket:', error)
      return {
        code: TicketErrorCodes.ASSIGNMENT_ERROR,
        message: 'Failed to auto-assign ticket',
        details: error
      }
    }
  }

  /**
   * Remove a skill from a ticket
   */
  static async removeTicketSkill(skillId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('ticket_skills')
        .delete()
        .eq('id', skillId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Error removing ticket skill:', error)
      return {
        error: 'Failed to remove skill from ticket'
      }
    }
  }

  /**
   * Manually trigger re-assignment of a ticket
   */
  static async reassignTicket(ticketId: string): Promise<{ data: string | null, error: string | null }> {
    try {
      const { data, error } = await supabase
        .rpc('auto_assign_ticket', { p_ticket_id: ticketId })

      if (error) throw error

      // If an agent was assigned, return their ID
      if (data) {
        return { data, error: null }
      }

      // If no agent was found
      return { 
        data: null, 
        error: 'No suitable agent found. Check required skills and agent availability.' 
      }
    } catch (error) {
      console.error('Error reassigning ticket:', error)
      return {
        data: null,
        error: 'Failed to reassign ticket'
      }
    }
  }
} 