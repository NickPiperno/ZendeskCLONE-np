import { supabase } from './supabase'
import type { TicketNote, TicketNoteInsert, TicketNoteUpdate } from '@/modules/tickets/types/ticket-note.types'

// Error codes for better error tracking and handling
export const TicketNoteErrorCodes = {
  UNAUTHORIZED: 'TICKET_NOTE_UNAUTHORIZED',
  VALIDATION_ERROR: 'TICKET_NOTE_VALIDATION_ERROR',
  NOT_FOUND: 'TICKET_NOTE_NOT_FOUND',
  CREATE_ERROR: 'TICKET_NOTE_CREATE_ERROR',
  UPDATE_ERROR: 'TICKET_NOTE_UPDATE_ERROR',
  DELETE_ERROR: 'TICKET_NOTE_DELETE_ERROR',
  FETCH_ERROR: 'TICKET_NOTE_FETCH_ERROR'
} as const

type TicketNoteErrorCode = typeof TicketNoteErrorCodes[keyof typeof TicketNoteErrorCodes]

interface TicketNoteError {
  code: TicketNoteErrorCode
  message: string
  details?: unknown
}

/**
 * Service class for handling ticket note operations
 * Includes error handling and logging
 */
export class TicketNoteService {
  /**
   * Validate note data before operations
   */
  private static validateNote(note: Partial<TicketNoteInsert>) {
    const errors: string[] = []

    if (!note.content?.trim()) {
      errors.push('Content is required')
    }

    if (!note.ticket_id) {
      errors.push('Ticket ID is required')
    }

    return errors
  }

  /**
   * Create a new note
   */
  static async createNote(note: Omit<TicketNoteInsert, 'created_at' | 'updated_at' | 'user_id'>) {
    try {
      // Validate user session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError) {
        throw {
          code: TicketNoteErrorCodes.UNAUTHORIZED,
          message: 'Authentication required',
          details: sessionError
        }
      }
      if (!user) {
        throw {
          code: TicketNoteErrorCodes.UNAUTHORIZED,
          message: 'You must be logged in to create a note'
        }
      }

      // Validate note data
      const validationErrors = this.validateNote(note)
      if (validationErrors.length > 0) {
        throw {
          code: TicketNoteErrorCodes.VALIDATION_ERROR,
          message: 'Invalid note data',
          details: validationErrors
        }
      }

      console.log('Creating note:', { ...note, content: '...' })
      
      const { data, error } = await supabase
        .from('ticket_notes')
        .insert([{
          ...note,
          is_internal: note.is_internal ?? true
        }])
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw {
          code: TicketNoteErrorCodes.CREATE_ERROR,
          message: 'Failed to create note',
          details: error
        }
      }

      console.log('Note created successfully:', data.id)
      return { data: data as TicketNote, error: null }
    } catch (error) {
      const noteError = error as TicketNoteError
      console.error('Failed to create note:', {
        code: noteError.code || TicketNoteErrorCodes.CREATE_ERROR,
        message: noteError.message,
        details: noteError.details
      })
      
      return { 
        data: null, 
        error: noteError.message || 'An unexpected error occurred while creating the note'
      }
    }
  }

  /**
   * Fetch notes for a ticket
   */
  static async getNotes(ticketId: string) {
    try {
      // Validate user session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !user) {
        throw {
          code: TicketNoteErrorCodes.UNAUTHORIZED,
          message: 'Authentication required to fetch notes',
          details: sessionError
        }
      }

      console.log('Fetching notes for ticket:', ticketId)

      const { data, error } = await supabase
        .from('ticket_notes')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Supabase error:', error)
        throw {
          code: TicketNoteErrorCodes.FETCH_ERROR,
          message: 'Failed to fetch notes',
          details: error
        }
      }

      console.log(`Successfully fetched ${data?.length || 0} notes`)
      return { data: data as TicketNote[], error: null }
    } catch (error) {
      const noteError = error as TicketNoteError
      console.error('Failed to fetch notes:', {
        code: noteError.code || TicketNoteErrorCodes.FETCH_ERROR,
        message: noteError.message,
        details: noteError.details
      })
      
      return { 
        data: null, 
        error: noteError.message || 'An unexpected error occurred while fetching notes'
      }
    }
  }

  /**
   * Update an existing note
   */
  static async updateNote(id: string, updates: TicketNoteUpdate) {
    try {
      // Validate user session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !user) {
        throw {
          code: TicketNoteErrorCodes.UNAUTHORIZED,
          message: 'Authentication required to update note',
          details: sessionError
        }
      }

      // Validate note data
      if (updates.content && !updates.content.trim()) {
        throw {
          code: TicketNoteErrorCodes.VALIDATION_ERROR,
          message: 'Content cannot be empty'
        }
      }

      console.log('Updating note:', id, updates)

      const { data, error } = await supabase
        .from('ticket_notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw {
          code: TicketNoteErrorCodes.UPDATE_ERROR,
          message: 'Failed to update note',
          details: error
        }
      }

      console.log('Note updated successfully:', id)
      return { data: data as TicketNote, error: null }
    } catch (error) {
      const noteError = error as TicketNoteError
      console.error('Failed to update note:', {
        code: noteError.code || TicketNoteErrorCodes.UPDATE_ERROR,
        message: noteError.message,
        details: noteError.details
      })
      
      return { 
        data: null, 
        error: noteError.message || 'An unexpected error occurred while updating the note'
      }
    }
  }

  /**
   * Delete a note (soft delete)
   */
  static async deleteNote(id: string) {
    try {
      // Validate user session
      const { data: { user }, error: sessionError } = await supabase.auth.getUser()
      if (sessionError || !user) {
        throw {
          code: TicketNoteErrorCodes.UNAUTHORIZED,
          message: 'Authentication required to delete note',
          details: sessionError
        }
      }

      console.log('Soft deleting note:', id)

      const { error } = await supabase
        .from('ticket_notes')
        .update({
          deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        console.error('Supabase error:', error)
        throw {
          code: TicketNoteErrorCodes.DELETE_ERROR,
          message: 'Failed to delete note',
          details: error
        }
      }

      console.log('Note soft deleted successfully:', id)
      return { error: null }
    } catch (error) {
      const noteError = error as TicketNoteError
      console.error('Failed to delete note:', noteError)
      return { 
        error: noteError.message || 'An unexpected error occurred while deleting the note'
      }
    }
  }
} 