import { supabase } from './supabase'
import type { Ticket, TicketInsert, TicketUpdate } from '@/modules/tickets/types/ticket.types'
import { PostgrestError } from '@supabase/supabase-js'

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
  agent_id: string | null
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
  static async createTicket(ticket: Omit<TicketInsert, 'created_at' | 'updated_at'>) {
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

      // Get user profile to check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

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
          // If admin is creating ticket and user_id is provided, use that, otherwise use current user's ID
          user_id: profile?.role === 'admin' && ticket.user_id ? ticket.user_id : user.id,
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
        .eq('deleted', false)  // Only show non-deleted tickets

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
  static async findBestAgentMatch(ticketId: string): Promise<AgentMatch | null> {
    try {
      const { data, error } = await supabase
        .rpc('find_best_agent_match', { p_ticket_id: ticketId })

      if (error) {
        console.error('Database error in find_best_agent_match:', error.message)
        return null
      }

      // Log the response for debugging
      console.log('Database response:', data)
      
      return data as AgentMatch
    } catch (error) {
      console.error('Error in findBestAgentMatch:', error instanceof PostgrestError ? error.message : 'Unknown error')
      return null
    }
  }

  /**
   * Automatically assign ticket to best matching agent
   */
  static async autoAssignTicket(ticketId: string): Promise<string | TicketError> {
    try {
      console.log('Starting auto-assignment for ticket:', ticketId)
      const { data, error } = await supabase
        .rpc('auto_assign_ticket', { p_ticket_id: ticketId })

      if (error) {
        console.error('Database error during auto-assignment:', error)
        throw error
      }
      
      console.log('Auto-assignment result:', data)
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
   * Get all agents and their skills
   */
  static async getAllAgentSkills() {
    try {
      const { data, error } = await supabase
        .rpc('get_all_user_skills')

      if (error) {
        console.error('Error getting agent skills:', error)
        return {
          code: TicketErrorCodes.SKILL_ERROR,
          message: 'Failed to get agent skills',
          details: error
        }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error getting agent skills:', error)
      return {
        data: null,
        error: 'Failed to get agent skills'
      }
    }
  }

  /**
   * Get agent schedules for current day
   */
  static async getAgentSchedules() {
    try {
      const currentDay = new Date().getDay() // 0-6, where 0 is Sunday
      const { data, error } = await supabase
        .from('team_schedules')
        .select('*')
        .eq('day_of_week', currentDay)

      if (error) {
        console.error('Error getting agent schedules:', error)
        return {
          code: TicketErrorCodes.FETCH_ERROR,
          message: 'Failed to get agent schedules',
          details: error
        }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error getting agent schedules:', error)
      return {
        data: null,
        error: 'Failed to get agent schedules'
      }
    }
  }

  /**
   * Manually trigger re-assignment of a ticket
   */
  static async reassignTicket(ticketId: string): Promise<{ data: string | null, error: string | null }> {
    try {
      console.log('=== Starting ticket reassignment process ===')
      console.log('Ticket ID:', ticketId)
      
      // First check if ticket has required skills
      console.log('Step 1: Fetching ticket skills...')
      const skills = await TicketService.getTicketSkills(ticketId)
      if ('code' in skills) {
        console.error('Error getting ticket skills:', skills)
        throw new Error('Failed to get ticket skills')
      }
      console.log('Required skills found:', JSON.stringify(skills, null, 2))
      
      // Get all agent skills for debugging
      console.log('Step 2: Fetching all agent skills...')
      const agentSkills = await TicketService.getAllAgentSkills()
      if (agentSkills.error) {
        console.error('Error getting agent skills:', agentSkills.error)
      } else {
        console.log('Available agents and their skills:', JSON.stringify(agentSkills.data, null, 2))
      }

      // Get agent schedules for debugging
      console.log('Step 3: Fetching agent schedules...')
      const schedules = await TicketService.getAgentSchedules()
      if (schedules.error) {
        console.error('Error getting agent schedules:', schedules.error)
      } else {
        const currentTime = new Date().toLocaleTimeString()
        console.log('Current time:', currentTime)
        console.log('Current day:', new Date().getDay())
        console.log('Agent schedules:', JSON.stringify(schedules.data, null, 2))
      }
      
      // Find potential agent match
      console.log('Step 4: Finding best agent match...')
      const bestMatch = await TicketService.findBestAgentMatch(ticketId)
      console.log('Best agent match result:', JSON.stringify(bestMatch, null, 2))
      
      // Check if we got an error or no match
      if (!bestMatch || !bestMatch.agent_id) {
        console.log('No suitable agent found:', bestMatch?.reason || 'Unknown reason')
        return { 
          data: null, 
          error: bestMatch?.reason || 'No suitable agent found. Check required skills and agent availability.' 
        }
      }

      // At this point bestMatch must contain a valid agent_id
      // We have a match, proceed with auto-assignment
      console.log('Step 5: Proceeding with auto-assignment...')
      console.log('Calling auto_assign_ticket with ID:', ticketId)
      const { data, error } = await supabase
        .rpc('auto_assign_ticket', { p_ticket_id: ticketId })

      if (error) {
        console.error('Database error during auto-assignment:', error)
        throw error
      }

      console.log('Auto-assignment result:', data)

      // If an agent was assigned, return their ID
      if (data) {
        console.log('=== Ticket reassignment successful ===')
        return { data, error: null }
      }

      // If no agent was found (shouldn't happen at this point, but just in case)
      console.log('=== Ticket reassignment failed - no agent assigned ===')
      return { 
        data: null, 
        error: 'Failed to assign ticket to matched agent.' 
      }
    } catch (error) {
      console.error('=== Ticket reassignment failed with error ===')
      console.error('Error details:', error)
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to reassign ticket'
      }
    }
  }
} 