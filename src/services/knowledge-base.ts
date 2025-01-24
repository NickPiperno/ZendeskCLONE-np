import { supabase } from './supabase'
import type { 
    KBArticle, 
    KBCategory, 
    GetKBArticleResponse,
    SearchKBArticlesResponse
} from './types/knowledge-base.types'

/**
 * Knowledge Base service for handling article and category operations
 */
export const knowledgeBaseService = {
    /**
     * Create a new knowledge base article
     */
    async createArticle(data: {
        title: string
        content: string
        category_id?: string
        is_published?: boolean
        tags?: string[]
    }): Promise<KBArticle> {
        const { data: profile } = await supabase.auth.getUser()
        if (!profile.user) throw new Error('Not authenticated')

        const { data: article, error } = await supabase
            .from('kb_articles')
            .insert({
                title: data.title,
                content: data.content,
                category_id: data.category_id,
                author_id: profile.user.id,
                is_published: data.is_published ?? false
            })
            .select()
            .single()

        if (error) throw error
        if (!article) throw new Error('Failed to create article')

        // Insert tags if provided
        if (data.tags && data.tags.length > 0) {
            const tagInserts = data.tags.map(tag => ({
                article_id: article.id,
                tag: tag.toLowerCase().trim()
            }))

            const { error: tagError } = await supabase
                .from('kb_article_tags')
                .insert(tagInserts)

            if (tagError) {
                console.error('Error inserting tags:', tagError)
            }
        }

        return article
    },

    /**
     * Search articles using the full-text search capability
     */
    async searchArticles(query: string, categoryId?: string): Promise<SearchKBArticlesResponse[]> {
        const { data, error } = await supabase
            .rpc('search_kb_articles', {
                search_query: query,
                p_category_id: categoryId
            })

        if (error) throw error
        return data
    },

    /**
     * Get a single article with its category, tags, and feedback summary
     */
    async getArticle(articleId: string): Promise<GetKBArticleResponse | null> {
        const { data: article, error: articleError } = await supabase
            .from('kb_articles')
            .select(`
                *,
                category:kb_categories(*),
                tags:kb_article_tags(*)
            `)
            .eq('id', articleId)
            .single()

        if (articleError) throw articleError
        if (!article) return null

        // Get feedback summary
        const { data: feedback, error: feedbackError } = await supabase
            .from('kb_article_feedback')
            .select('is_helpful')
            .eq('article_id', articleId)

        if (feedbackError) throw feedbackError

        const feedbackSummary = feedback.reduce(
            (acc, curr) => {
                if (curr.is_helpful) acc.helpful_count++
                else acc.not_helpful_count++
                return acc
            },
            { helpful_count: 0, not_helpful_count: 0 }
        )

        return {
            ...article,
            feedback_summary: feedbackSummary
        }
    },

    /**
     * Get all categories, optionally filtered by parent_id
     */
    async getCategories(parentId?: string): Promise<KBCategory[]> {
        const query = supabase
            .from('kb_categories')
            .select('*')
            .eq('is_active', true)
            .eq('deleted', false)

        if (parentId) {
            query.eq('parent_id', parentId)
        }

        const { data, error } = await query
        if (error) throw error
        return data
    },

    /**
     * Get articles in a category
     */
    async getCategoryArticles(categoryId: string): Promise<KBArticle[]> {
        const { data, error } = await supabase
            .from('kb_articles')
            .select('*')
            .eq('category_id', categoryId)
            .eq('is_published', true)
            .eq('deleted', false)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    },

    /**
     * Submit feedback for an article
     */
    async submitFeedback(articleId: string, isHelpful: boolean, comment?: string) {
        const {
            data: { user },
        } = await supabase.auth.getUser()

        const { error } = await supabase
            .from('kb_article_feedback')
            .upsert({
                article_id: articleId,
                user_id: user?.id,
                is_helpful: isHelpful,
                comment: comment
            })

        if (error) throw error
    },

    /**
     * Increment the view count for an article
     */
    async incrementViewCount(articleId: string) {
        // First get current count
        const { data: article, error: getError } = await supabase
            .from('kb_articles')
            .select('view_count')
            .eq('id', articleId)
            .single()

        if (getError) throw getError
        if (!article) return

        // Then increment it
        const { error: updateError } = await supabase
            .from('kb_articles')
            .update({ 
                view_count: (article.view_count || 0) + 1
            })
            .eq('id', articleId)

        if (updateError) throw updateError
    }
} 