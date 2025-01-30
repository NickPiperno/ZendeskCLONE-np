export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Custom Enumerated Types
export type ThreadType = 'customer_initiated' | 'agent_initiated' | 'ai_initiated'
export type ThreadStatus = 'open' | 'closed'
export type MessageType = 'customer' | 'agent' | 'system' | 'ai'
export type UserRole = 'admin' | 'agent' | 'user'
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type SkillCategory = 'technical' | 'product' | 'language' | 'soft_skill'
export type DocumentType = 'kb_article' | 'ticket' | 'team'

export interface Database {
  public: {
    Tables: {
      ai_documents: {
        Row: {
          id: string
          content: string
          metadata: Json
          embedding: number[]
          document_type: DocumentType
          reference_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          content: string
          metadata?: Json
          embedding: number[]
          document_type: DocumentType
          reference_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          content?: string
          metadata?: Json
          embedding?: number[]
          document_type?: DocumentType
          reference_id?: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // ... other tables will be here from your Supabase type generation
    }
    Enums: {
      thread_type: ThreadType
      thread_status: ThreadStatus
      message_type: MessageType
      user_role: UserRole
      ticket_status: TicketStatus
      ticket_priority: TicketPriority
      skill_category: SkillCategory
      document_type: DocumentType
    }
    // ... other schema definitions
  }
} 