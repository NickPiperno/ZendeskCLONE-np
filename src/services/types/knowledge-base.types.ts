import { Database } from './database.types'

/**
 * Knowledge Base Category type
 * Represents a hierarchical category in the knowledge base
 */
export interface KBCategory {
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

/**
 * Knowledge Base Article type
 * Represents a single article in the knowledge base with full-text search capabilities
 */
export interface KBArticle {
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

/**
 * Knowledge Base Article Tag type
 * Represents tags associated with articles for better categorization
 */
export interface KBArticleTag {
    id: string
    created_at: string
    updated_at: string
    article_id: string
    name: string
}

/**
 * Knowledge Base Article Feedback type
 * Represents user feedback on articles
 */
export interface KBArticleFeedback {
    id: string
    created_at: string
    updated_at: string
    article_id: string
    user_id: string
    is_helpful: boolean
    comment: string | null
}

/**
 * Search result type from the search_kb_articles function
 */
export interface KBSearchResult {
    id: string
    title: string
    content_preview: string
    category_id: string | null
    rank: number
}

/**
 * Database type extensions for Supabase
 */
export type Tables = Database['public']['Tables']
export type KBTables = {
    kb_categories: Tables['kb_categories']
    kb_articles: Tables['kb_articles']
    kb_article_tags: Tables['kb_article_tags']
    kb_article_feedback: Tables['kb_article_feedback']
}

// Type-safe query response types
export type GetKBArticleResponse = KBArticle & {
    category: KBCategory | null
    tags: KBArticleTag[]
    feedback_summary: {
        helpful_count: number
        not_helpful_count: number
    }
}

export type SearchKBArticlesResponse = KBSearchResult & {
    category: Pick<KBCategory, 'id' | 'name'> | null
}

export interface CreateKBArticleData {
    title: string;
    content: string;
    category_id: string;
    tags?: string[];
    is_published?: boolean;
} 