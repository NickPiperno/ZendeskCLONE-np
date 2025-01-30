import { z } from "zod";
import { BaseAgent } from "../agents";
import { SupabaseClient } from "@supabase/supabase-js";

// Define KB operation schemas
const articleSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  content: z.string(),
  category_id: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  last_updated: z.string().datetime().optional()
});

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  parent_id: z.string().optional()
});

type Article = z.infer<typeof articleSchema>;
type Category = z.infer<typeof categorySchema>;

export class KBHandler implements BaseAgent {
  name = "KB Handler";
  description = "Handles Knowledge Base operations for articles and categories";
  
  constructor(private supabase: SupabaseClient) {}

  async process(input: {
    operation: 'view' | 'search' | 'create' | 'update',
    entities: Record<string, any>,
    context?: any
  }): Promise<string> {
    try {
      switch (input.operation) {
        case 'view':
          return await this.viewArticle(input.entities);
        case 'search':
          return await this.searchArticles(input.entities);
        case 'create':
          return await this.createArticle(input.entities);
        case 'update':
          return await this.updateArticle(input.entities);
        default:
          throw new Error(`Unsupported operation: ${input.operation}`);
      }
    } catch (error) {
      console.error("KB operation failed:", error);
      throw new Error(`Failed to perform KB operation: ${input.operation}`);
    }
  }

  private async viewArticle(entities: Record<string, any>): Promise<string> {
    const articleId = entities.article_id?.[0]?.value;
    if (!articleId) {
      throw new Error("Article ID not provided");
    }

    const { data, error } = await this.supabase
      .from('kb_articles')
      .select(`
        *,
        categories (
          name,
          description
        )
      `)
      .eq('id', articleId)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Article not found");

    return JSON.stringify(data, null, 2);
  }

  private async searchArticles(entities: Record<string, any>): Promise<string> {
    const categoryName = entities.category_name?.[0]?.value;
    const query = this.supabase
      .from('kb_articles')
      .select(`
        *,
        categories (
          name,
          description
        )
      `);

    if (categoryName) {
      query.eq('categories.name', categoryName);
    }

    const { data, error } = await query;
    if (error) throw error;

    return JSON.stringify(data, null, 2);
  }

  private async createArticle(entities: Record<string, any>): Promise<string> {
    // Validate input data
    const articleData = articleSchema.parse(entities);

    const { data, error } = await this.supabase
      .from('kb_articles')
      .insert(articleData)
      .select()
      .single();

    if (error) throw error;
    return JSON.stringify(data, null, 2);
  }

  private async updateArticle(entities: Record<string, any>): Promise<string> {
    const articleId = entities.article_id?.[0]?.value;
    if (!articleId) {
      throw new Error("Article ID not provided for update");
    }

    // Validate update data
    const updateData = articleSchema.partial().parse(entities);

    const { data, error } = await this.supabase
      .from('kb_articles')
      .update(updateData)
      .eq('id', articleId)
      .select()
      .single();

    if (error) throw error;
    return JSON.stringify(data, null, 2);
  }

  // Category operations
  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    const { data: category, error } = await this.supabase
      .from('kb_categories')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return category;
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    const { data: category, error } = await this.supabase
      .from('kb_categories')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return category;
  }
}

// Export factory function
export const createKBHandler = (supabase: SupabaseClient): KBHandler => {
  return new KBHandler(supabase);
}; 