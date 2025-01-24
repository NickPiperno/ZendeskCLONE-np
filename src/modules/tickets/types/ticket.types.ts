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

export interface TicketSummary {
    status: string
    count: number
    last_update: string
}

export interface TicketTimelineEvent {
    event_time: string
    event_type: 'status_change' | 'note_added' | 'assignment_change'
    event_description: string
    actor_name: string
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