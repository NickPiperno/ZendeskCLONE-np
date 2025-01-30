import { BaseAgent, ChatModel } from '../types';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { supabase } from '@/services/supabase';

// Define input schema
const kbAgentInputSchema = z.object({
  operation: z.enum(['kb_search', 'kb_create', 'kb_update']),
  parameters: z.record(z.any()),
  context: z.any().optional()
});

// Define output schema for execution agent
const kbAgentOutputSchema = z.object({
  operation: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
  table: z.enum(['kb_articles', 'kb_categories', 'kb_tags']),
  data: z.record(z.any()),
  conditions: z.array(z.record(z.any())),
  responseTemplate: z.object({
    success: z.string(),
    error: z.string()
  })
});

type KBAgentInput = z.infer<typeof kbAgentInputSchema>;
type KBAgentOutput = z.infer<typeof kbAgentOutputSchema>;

export class KBAgent implements BaseAgent {
  name = "Knowledge Base Agent";
  description = "Manages knowledge base operations";

  constructor(
    private llm: ChatModel
  ) {}

  async process(input: string | KBAgentInput): Promise<string> {
    try {
      // Parse input
      const parsedInput = typeof input === 'string' 
        ? JSON.parse(input) 
        : input;
      const validatedInput = kbAgentInputSchema.parse(parsedInput);

      // Process based on operation
      let result: KBAgentOutput;
      switch (validatedInput.operation) {
        case 'kb_search':
          result = await this.handleSearch(validatedInput);
          break;
        case 'kb_create':
          result = await this.handleCreate(validatedInput);
          break;
        case 'kb_update':
          result = await this.handleUpdate(validatedInput);
          break;
        default:
          throw new Error(`Unsupported operation: ${validatedInput.operation}`);
      }

      // Validate and return result
      return JSON.stringify(kbAgentOutputSchema.parse(result));
    } catch (error) {
      console.error('KB agent processing failed:', error);
      throw error;
    }
  }

  private async handleSearch(input: KBAgentInput): Promise<KBAgentOutput> {
    const { parameters } = input;
    return {
      operation: 'SELECT',
      table: 'kb_articles',
      data: {},
      conditions: [
        ...(parameters.articleId ? [{ id: parameters.articleId }] : []),
        ...(parameters.category ? [{ category: parameters.category }] : []),
        ...(parameters.tags ? [{ tags: parameters.tags }] : [])
      ],
      responseTemplate: {
        success: 'Found {count} articles matching your criteria',
        error: 'No articles found matching your criteria'
      }
    };
  }

  private async handleCreate(input: KBAgentInput): Promise<KBAgentOutput> {
    const { parameters } = input;
    return {
      operation: 'INSERT',
      table: 'kb_articles',
      data: {
        title: parameters.title,
        content: parameters.content,
        category_id: parameters.categoryId,
        tags: parameters.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      conditions: [],
      responseTemplate: {
        success: 'Article "{title}" created successfully',
        error: 'Failed to create article: {error}'
      }
    };
  }

  private async handleUpdate(input: KBAgentInput): Promise<KBAgentOutput> {
    const { parameters } = input;

    // Validate and normalize article ID
    if (!parameters.articleId || !this.isValidUUID(parameters.articleId)) {
      // Try to find article by title/reference if provided
      if (parameters.articleTitle || parameters.articleReference) {
        const searchQuery = parameters.articleTitle || parameters.articleReference;
        const searchResult = await this.findArticleByTitle(searchQuery);
        if (searchResult?.id) {
          parameters.articleId = searchResult.id;
        } else {
          throw new Error(`Could not find article with title/reference: ${searchQuery}`);
        }
      } else {
        throw new Error('Valid article identifier (UUID, title, or reference) is required for update');
      }
    }

    // Handle content update
    if (parameters.content) {
      return {
        operation: 'UPDATE',
        table: 'kb_articles',
        data: {
          content: parameters.content,
          updated_at: new Date().toISOString()
        },
        conditions: [{ id: parameters.articleId }],
        responseTemplate: {
          success: 'Article content updated successfully',
          error: 'Failed to update article content: {error}'
        }
      };
    }

    // Handle category update
    if (parameters.categoryId) {
      return {
        operation: 'UPDATE',
        table: 'kb_articles',
        data: {
          category_id: parameters.categoryId,
          updated_at: new Date().toISOString()
        },
        conditions: [{ id: parameters.articleId }],
        responseTemplate: {
          success: 'Article category updated successfully',
          error: 'Failed to update article category: {error}'
        }
      };
    }

    // Handle tags update
    if (parameters.tags) {
      return {
        operation: 'UPDATE',
        table: 'kb_articles',
        data: {
          tags: parameters.tags,
          updated_at: new Date().toISOString()
        },
        conditions: [{ id: parameters.articleId }],
        responseTemplate: {
          success: 'Article tags updated successfully',
          error: 'Failed to update article tags: {error}'
        }
      };
    }

    throw new Error('No valid update parameters provided');
  }

  // Helper method to validate UUID
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  // Helper method to find article by title
  private async findArticleByTitle(title: string): Promise<{ id: string } | null> {
    // Use the supabase client to search for articles
    const { data, error } = await supabase
      .from('kb_articles')
      .select('id, title')
      .ilike('title', `%${title}%`)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('Error finding article by title:', error);
      return null;
    }

    return { id: data.id };
  }
}

// Export singleton instance
export const kbAgent = new KBAgent(new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0
})); 