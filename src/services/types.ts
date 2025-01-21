import type { Ticket, TicketInsert, TicketUpdate } from '../modules/tickets/types/ticket.types'
import type { User, UserInsert, UserUpdate } from '../modules/auth/types/user.types'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tickets: {
        Row: Ticket
        Insert: TicketInsert
        Update: TicketUpdate
      }
      users: {
        Row: User
        Insert: UserInsert
        Update: UserUpdate
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ticket_status: 'open' | 'in_progress' | 'resolved' | 'closed'
      ticket_priority: 'low' | 'medium' | 'high' | 'urgent'
      user_role: 'admin' | 'agent' | 'user'
    }
  }
} 