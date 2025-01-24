/**
 * Types for ticket notes functionality
 */

export interface TicketNote {
  id: string
  ticket_id: string
  content: string
  created_at: string
  updated_at: string
  created_by: string
  is_internal: boolean
  deleted: boolean
  deleted_at: string | null
  profiles: {
    full_name: string
    email: string
  }
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