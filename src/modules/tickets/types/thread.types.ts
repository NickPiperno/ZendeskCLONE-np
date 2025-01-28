import { z } from 'zod'
import type { TicketTimelineEvent } from './ticket.types'

// Thread Types
export type ThreadType = 'customer_initiated' | 'agent_initiated' | 'ai_initiated'
export type ThreadStatus = 'open' | 'closed'
export type MessageType = 'customer' | 'agent' | 'system' | 'ai'

// Base Thread Interface
export interface Thread {
    id: string
    ticket_id: string
    created_at: string
    updated_at: string
    title?: string
    status: ThreadStatus
    thread_type: ThreadType
    ai_context: ThreadAIMetadata
    deleted: boolean
    deleted_at?: string
}

// Thread AI Context
export interface ThreadAIMetadata {
    context_type: 'question' | 'feedback' | 'issue' | 'request'
    priority_indicator: number
    sentiment?: 'positive' | 'negative' | 'neutral'
    category_tags?: string[]
    last_processed?: string
    processing_status?: 'pending' | 'completed' | 'failed'
    error_details?: string
}

// Thread Note Interface
export interface ThreadNote {
    id: string
    created_at: string
    thread_id: string
    ticket_id: string
    content: string
    created_by: string
    message_type: MessageType
    is_internal: boolean
    metadata?: {
        ai_processed: boolean
        sentiment?: string
        category?: string
    }
    profiles?: {
        full_name: string
        role: string
    }
}

// Enhanced Timeline Event
export interface EnhancedTimelineEvent extends Omit<TicketTimelineEvent, 'thread_context'> {
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
        message_count?: number
        last_update?: string
        ai_summary?: string
    }
}

// Zod Schemas
export const threadTypeSchema = z.enum(['customer_initiated', 'agent_initiated', 'ai_initiated'])
export const threadStatusSchema = z.enum(['open', 'closed'])
export const messageTypeSchema = z.enum(['customer', 'agent', 'system', 'ai'])

export const threadAIMetadataSchema = z.object({
    context_type: z.enum(['question', 'feedback', 'issue', 'request']),
    priority_indicator: z.number().min(0).max(1),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
    category_tags: z.array(z.string()).optional(),
    last_processed: z.string().optional(),
    processing_status: z.enum(['pending', 'completed', 'failed']).optional(),
    error_details: z.string().optional()
})

export const threadSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    created_at: z.string(),
    updated_at: z.string(),
    title: z.string().optional(),
    status: z.enum(['open', 'closed']),
    thread_type: z.enum(['customer_initiated', 'agent_initiated', 'ai_initiated']),
    ai_context: threadAIMetadataSchema,
    deleted: z.boolean(),
    deleted_at: z.string().optional()
})

export const threadNoteSchema = z.object({
    id: z.string().uuid(),
    created_at: z.string(),
    thread_id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    content: z.string(),
    created_by: z.string().uuid(),
    message_type: z.enum(['customer', 'agent', 'system', 'ai']),
    is_internal: z.boolean(),
    metadata: z.object({
        ai_processed: z.boolean(),
        sentiment: z.string().optional(),
        category: z.string().optional()
    }).optional(),
    profiles: z.object({
        full_name: z.string(),
        role: z.string()
    }).optional()
})

export const enhancedTimelineEventSchema = z.object({
    event_time: z.string().datetime(),
    event_type: z.string(),
    event_description: z.string(),
    actor_name: z.string(),
    thread_id: z.string().uuid().nullable(),
    thread_context: z.object({
        ticket_id: z.string().uuid().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        thread_type: z.string().optional(),
        ai_context: z.record(z.any()).optional(),
        message_type: z.string().optional(),
        ai_processed: z.boolean().optional(),
        old_status: z.string().optional(),
        new_status: z.string().optional(),
        assigned_to: z.string().uuid().nullable().optional(),
        message_count: z.number().int().min(0).optional(),
        last_update: z.string().datetime().optional(),
        ai_summary: z.string().optional()
    })
})

// Input Schemas for API Endpoints
export const createThreadSchema = z.object({
    title: z.string().max(255).optional(),
    initial_message: z.string().min(1),
    thread_type: threadTypeSchema
})

export const updateThreadSchema = z.object({
    title: z.string().max(255).optional(),
    status: threadStatusSchema.optional()
})

export const createMessageSchema = z.object({
    content: z.string().min(1),
    message_type: messageTypeSchema
})

export const updateMessageSchema = z.object({
    content: z.string().min(1)
}) 