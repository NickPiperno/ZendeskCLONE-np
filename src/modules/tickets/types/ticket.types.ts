export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'urgent' | 'high' | 'medium' | 'low'

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
  title: string
  description: string
  status?: TicketStatus
  priority?: TicketPriority
  user_id?: string
  assigned_to?: string
  created_at?: string
  updated_at?: string
  deleted?: boolean
  deleted_at?: string
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

export interface TicketSummary {
    status: string
    count: number
    last_update: string
}

export type TicketTimelineEventType = 
  | 'status_change'
  | 'note_added'
  | 'assignment_change'
  | 'thread_created'
  | 'message_added'

export interface TicketTimelineEvent {
  event_time: string
  event_type: 'ticket_created' | 'thread_created' | 'message_added' | 'status_change' | 'assignment_change'
  event_description: string
  actor_name: string
  thread_id: string | null
  thread_context: {
    ticket_id?: string
    title?: string
    description?: string
    thread_type?: string
    ai_context?: Record<string, any>
    message_type?: string
    ai_processed?: boolean
    old_status?: string
    new_status?: string
    assigned_to?: string | null
  }
}

export interface CustomerTicket {
    id: string
    created_at: string
    updated_at: string
    title: string
    description: string | null
    status: TicketStatus
    priority: TicketPriority
    has_agent: boolean
    user_id: string
} 