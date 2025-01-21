export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Ticket {
  id: string
  created_at: string
  updated_at: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  user_id: string
  assigned_to?: string
}

export interface TicketInsert {
  id?: string
  created_at?: string
  updated_at?: string
  title: string
  description: string
  status?: TicketStatus
  priority?: TicketPriority
  user_id: string
  assigned_to?: string
}

export interface TicketUpdate {
  id?: string
  created_at?: string
  updated_at?: string
  title?: string
  description?: string
  status?: TicketStatus
  priority?: TicketPriority
  user_id?: string
  assigned_to?: string
} 