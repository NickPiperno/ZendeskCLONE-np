/**
 * Types for ticket notes functionality
 */

export interface TicketNote {
  id: string
  created_at: string
  updated_at: string
  ticket_id: string
  user_id: string
  content: string
  is_internal: boolean
  deleted: boolean
  deleted_at?: string
}

export interface TicketNoteInsert {
  id?: string
  created_at?: string
  updated_at?: string
  ticket_id: string
  user_id?: string // Set by RLS trigger
  content: string
  is_internal?: boolean
}

export interface TicketNoteUpdate {
  id?: string
  created_at?: string
  updated_at?: string
  content?: string
  is_internal?: boolean
} 