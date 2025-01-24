/**
 * Generated Types for Supabase Database Schema
 * This file defines the type structure for our database tables, views, and functions
 */

export interface Database {
    public: {
        Tables: {
            // Knowledge Base tables
            kb_categories: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    name: string
                    description: string | null
                    parent_id: string | null
                    is_active: boolean
                    deleted: boolean
                    deleted_at: string | null
                }
                Insert: Omit<Tables['kb_categories']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Tables['kb_categories']['Insert']>
            }
            kb_articles: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    title: string
                    content: string
                    category_id: string | null
                    author_id: string
                    is_published: boolean
                    view_count: number
                    helpful_count: number
                    not_helpful_count: number
                    last_reviewed_at: string | null
                    last_reviewed_by: string | null
                    deleted: boolean
                    deleted_at: string | null
                }
                Insert: Omit<Tables['kb_articles']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Tables['kb_articles']['Insert']>
            }
            kb_article_tags: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    article_id: string
                    name: string
                }
                Insert: Omit<Tables['kb_article_tags']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Tables['kb_article_tags']['Insert']>
            }
            kb_article_feedback: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    article_id: string
                    user_id: string
                    is_helpful: boolean
                    comment: string | null
                }
                Insert: Omit<Tables['kb_article_feedback']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Tables['kb_article_feedback']['Insert']>
            }
            // Customer Ticket tables and views
            tickets: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    title: string
                    description: string | null
                    status: string
                    priority: string
                    user_id: string
                    assigned_to: string | null
                    deleted: boolean
                    deleted_at: string | null
                }
                Insert: Omit<Tables['tickets']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Tables['tickets']['Insert']>
            }
            ticket_notes: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    ticket_id: string
                    created_by: string
                    content: string
                    is_internal: boolean
                    deleted: boolean
                    deleted_at: string | null
                }
                Insert: Omit<Tables['ticket_notes']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Tables['ticket_notes']['Insert']>
            }
        }
        Views: {
            customer_tickets: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    title: string
                    description: string | null
                    status: string
                    priority: string
                    has_agent: boolean
                    user_id: string
                }
            }
            customer_ticket_notes: {
                Row: {
                    id: string
                    created_at: string
                    ticket_id: string
                    content: string
                    created_by_name: string
                    author_type: string
                }
            }
        }
        Functions: {
            search_kb_articles: {
                Args: {
                    search_query: string
                    p_category_id?: string
                }
                Returns: {
                    id: string
                    title: string
                    content_preview: string
                    category_id: string | null
                    rank: number
                }[]
            }
            get_customer_ticket_timeline: {
                Args: {
                    p_ticket_id: string
                }
                Returns: {
                    event_time: string
                    event_type: string
                    event_description: string
                    actor_name: string
                }[]
            }
            get_customer_ticket_summary: {
                Args: {
                    p_user_id: string
                }
                Returns: {
                    status: string
                    count: number
                    last_update: string
                }[]
            }
        }
    }
}

// Helper type for Tables
export type Tables = Database['public']['Tables']