import { z } from 'zod';
import { BaseAgent } from './types';
import { ChatModel } from '../types';
import { ChatOpenAI } from '@langchain/openai';


// Define database operation types
const OperationType = z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);

// Define database table types
const TableName = z.enum(['kb_articles', 'ai_documents', 'kb_categories']);

// Define core KB operations
const KBOperations = z.enum([
  'draft_article',      // Create new article content
  'update_article',     // Update existing article
  'search_articles'     // Search using vectors
]);

type KBOperation = z.infer<typeof KBOperations>;

// Define input schema
const kbAgentInputSchema = z.object({
  operation: KBOperations,
  parameters: z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    category: z.string().optional(),
    category_id: z.string().uuid().optional(),
    author_id: z.string().uuid().optional(),
    is_published: z.boolean().optional(),
    metadata: z.record(z.any()).optional()
  }).passthrough(),
  context: z.any().optional()
});

// Define article source type
const ArticleSource = z.enum(['internal', 'general_knowledge', 'hybrid']);

// Define article metadata schema
const ArticleMetadata = z.object({
  article_type: z.string(),
  related_tickets: z.array(z.string().uuid()).optional(),
  platform: z.string().optional(),
  feature: z.string().optional(),
  source: ArticleSource,
  tags: z.array(z.string()).optional(),
  ai_indexed: z.boolean().optional()
});

// Define content source schema
const ContentSource = z.object({
  internal_references: z.array(z.object({
    type: z.enum(['ticket_thread', 'kb_article', 'ai_document']),
    id: z.string().uuid(),
    relevance: z.number()
  })),
  general_knowledge: z.object({
    included: z.boolean(),
    topics: z.array(z.string())
  })
});

// Add search parameters schema
const SearchParameters = z.object({
  category_id: z.string().uuid().optional(),
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

// Define article content schema
const ArticleContent = z.object({
  title: z.string(),
  content: z.string(),
  category_id: z.string().uuid(),
  metadata: ArticleMetadata,
  search_vector: z.array(z.number()).optional() // For vector search
});

// Define KB agent output schema
const KBAgentOutput = z.object({
  action: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
  table: z.enum(['kb_articles', 'ai_documents', 'kb_categories']),
  data: z.object({
    // Article fields
    title: z.string().optional(),
    content: z.string().optional(),
    category_id: z.string().uuid().optional(),
    author_id: z.string().uuid().optional(),
    is_published: z.boolean().optional(),
    deleted: z.boolean().optional(),
    
    // Search fields
    select: z.array(z.string()).optional(),
    transform: z.enum(['vector_search', 'semantic_search', 'category_group']).optional()
  }).passthrough(),
  conditions: z.array(z.record(z.any())).optional()
});

type KBOutput = z.infer<typeof KBAgentOutput>;

const PROMPT_TEMPLATE = `You are a Knowledge Base Agent responsible for managing help desk articles.
Your core responsibilities are:
1. Creating well-structured articles using internal data and general knowledge
2. Formatting content for the knowledge base
3. Ensuring content is searchable and properly indexed

IMPORTANT: When creating or updating articles, you MUST use a valid category_id that exists in the kb_categories table.
The category_id must be a valid UUID that references an existing category. Do not make up random UUIDs.

Current Request:
{input}

Context:
{context}

You must respond with a JSON object following this structure:

{
  "action": "INSERT" | "SELECT" | "UPDATE" | "DELETE",
  "table": "kb_articles" | "ai_documents" | "kb_categories",
  "data": {
    // For article operations:
    "title": string,                  // Required for creation
    "content": string,                // Required for creation
    "category_id": string,            // Required UUID from kb_categories table
    "author_id": string,              // Optional (UUID)
    "is_published": boolean,          // Optional
    
    // For search operations:
    "select": string[],               // Fields to select
    "transform": "vector_search" | "semantic_search" | "category_group"
  },
  "conditions": [                     // Optional search/update conditions
    { "field": "value" }
  ]
}

Example responses for different operations:

For article creation (assuming the category_id exists in kb_categories):
{
  "action": "INSERT",
  "table": "kb_articles",
  "data": {
    "title": "How to Reset Your Password",
    "content": "## Overview\\nThis guide explains the password reset process...\\n\\n## Steps\\n1. Click 'Forgot Password'\\n2. Enter your email\\n3. Follow the link in your email",
    "category_id": "{{VALID_CATEGORY_ID}}",  // Must be a valid UUID from kb_categories
    "is_published": false
  }
}

For vector search:
{
  "action": "SELECT",
  "table": "kb_articles",
  "data": {
    "select": ["title", "content", "category_id", "metadata"],
    "transform": "vector_search"
  },
  "conditions": [
    { "search_vector": { "similarity": 0.8 } },
    { "metadata": { "source": ["internal", "hybrid"] } }
  ]
}

Analyze the input and context, then generate the appropriate operation.`;

const ARTICLE_GENERATION_TEMPLATE = `You are a technical documentation expert. Your task is to create a comprehensive help desk article.

Article Requirements:
- Title should be clear and descriptive
- Content should be well-structured with markdown headings
- Include practical examples and steps where applicable
- Focus on troubleshooting and resolution steps
- Consider the target audience and platform

IMPORTANT JSON FORMATTING RULES:
1. Use proper JSON string escaping for newlines (\\n) and quotes (\")
2. Do not use actual newlines or control characters in JSON string values
3. All content must be properly escaped in a single line
4. Format markdown with \\n for newlines

Example of properly formatted response:
{
  "title": "Example Article",
  "content": "# Heading\\n\\nThis is a paragraph.\\n\\n## Subheading\\n\\n1. First item\\n2. Second item",
  "metadata": {
    "article_type": "guide",
    "target_audience": ["customers"],
    "platform": "web",
    "tags": ["example"]
  }
}

Request: {input}
Context: {context}

Generate a complete article with:
1. A clear title
2. Well-structured content using markdown with escaped newlines
3. Step-by-step instructions if applicable
4. Common issues and solutions
5. Related information or prerequisites

Remember: All string content must use \\n for newlines and be properly escaped.`;

export class KBAgent implements BaseAgent {
  name = "Knowledge Base Agent";
  description = "Creates and manages knowledge base articles with vector search support";

  constructor(
    private llm: ChatModel
  ) {}

  private async generateArticleContent(input: any, context: any): Promise<any> {
    try {
      console.group('📝 Generating Article Content');
      console.log('Input:', input);
      console.log('Context:', context);

      const prompt = ARTICLE_GENERATION_TEMPLATE
        .replace('{input}', JSON.stringify(input))
        .replace('{context}', JSON.stringify(context));

      const response = await this.llm.invoke(prompt);
      
      if (!response || typeof response.content !== 'string') {
        throw new Error('Invalid article generation response');
      }

      console.log('Raw LLM Response:', response.content);

      // Try to extract JSON from the response if it's wrapped in other text
      const jsonMatch = response.content.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) {
        throw new Error('No valid JSON object found in response');
      }

      // Parse the JSON directly - the LLM is already giving us valid JSON
      const parsedContent = JSON.parse(jsonMatch[1]);
      
      // Validate the required fields
      if (!parsedContent.title || !parsedContent.content) {
        throw new Error('Generated article missing required fields');
      }

      // Ensure metadata has the correct structure
      const metadata = {
        article_type: parsedContent.metadata?.article_type || 'guide',
        target_audience: parsedContent.metadata?.target_audience || ['customers'],
        platform: parsedContent.metadata?.platform || 'all',
        tags: parsedContent.metadata?.tags || [],
        source: 'internal' as const
      };

      const result = {
        title: parsedContent.title,
        content: parsedContent.content,
        metadata
      };

      console.log('Processed Article:', result);
      console.groupEnd();
      return result;
    } catch (error) {
      console.error('Article generation failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  async process(input: { 
    operation: z.infer<typeof KBOperations>;
    parameters: any;
    context: any;
  }): Promise<string> {
    try {
      console.group('📚 KB Agent');
      console.log('Input:', input);

      // Map operations to database actions
      const operationMap = {
        draft_article: 'INSERT',
        update_article: 'UPDATE',
        search_articles: 'SELECT'
      } as const;

      // Extract UUIDs from context if available
      const category_id = input.parameters.category_id || 
                         input.context?.category_id ||
                         input.context?.resolvedCategory?.id;
      const author_id = input.parameters.author_id || input.context?.author_id;

      if (input.operation === 'draft_article' && !category_id) {
        throw new Error('category_id is required for article creation');
      }

      let result;
      
      // For draft operations, generate article content first
      if (input.operation === 'draft_article') {
        console.log('Generating article content...');
        const generatedArticle = await this.generateArticleContent(input.parameters, input.context);
        
        result = {
          action: 'INSERT',
          table: 'kb_articles',
          data: {
            title: generatedArticle.title,
            content: generatedArticle.content,
            category_id: category_id,
            author_id: author_id,
            is_published: false
          }
        };
      } else {
        // For other operations, use the standard prompt
        const prompt = PROMPT_TEMPLATE
          .replace('{input}', JSON.stringify({
            operation: input.operation,
            parameters: {
              ...input.parameters,
              category_id,
              author_id
            }
          }))
          .replace('{context}', JSON.stringify(input.context));

        const response = await this.llm.invoke(prompt);
        
        if (!response || typeof response.content !== 'string') {
          throw new Error('Invalid LLM response format');
        }

        result = JSON.parse(response.content);
      }
      
      // Ensure the action matches the operation
      result.action = operationMap[input.operation];
      
      // Ensure UUIDs are properly set in the result
      if (result.data && input.operation === 'draft_article') {
        result.data.category_id = category_id;
        result.data.author_id = author_id;
      }
      
      const validated = KBAgentOutput.parse(result);

      console.log('Generated Output:', validated);
      console.groupEnd();
      return JSON.stringify(validated);
    } catch (error) {
      console.error('KB operation failed:', error);
      console.groupEnd();
      throw error;
    }
  }
}

// Export singleton instance
export const kbAgent = new KBAgent(new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0
})); 