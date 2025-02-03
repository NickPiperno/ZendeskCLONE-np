import { BaseAgent } from './types';
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { vectorStore } from '../config';
import { ChatModel } from '../types';
import { ProcessedInputSchema } from './input-processor-agent';
import { OpenAIEmbeddings } from '@langchain/openai';

// Extend the ProcessedInputSchema with our additional fields
const ExtendedProcessedInputSchema = ProcessedInputSchema.extend({
  criteria: z.object({
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    status: z.string().optional(),
    category: z.string().optional(),
    category_id: z.string().optional(),
    skill_id: z.string().optional(),
    proficiency_level: z.number().optional(),
    title: z.string().optional(),
    user_id: z.string().uuid().optional(),
    metadata: z.record(z.any()).optional()
  }).passthrough().optional()
});

type ProcessedInput = z.infer<typeof ExtendedProcessedInputSchema>;

// Define database types that match our schema exactly
interface DatabaseTypes {
  teams: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    member_count?: number;
  };
  skills: {
    id: string;
    name: string;
    category: 'technical' | 'product' | 'language' | 'soft_skill';
    description: string | null;
    is_active: boolean;
  };
  profiles: {
    id: string;
    full_name: string;
    role: string;
    email: string;
    is_active: boolean;
  };
  user_skills: {
    user_id: string;
    skill_id: string;
    proficiency_level: number;
    profiles: DatabaseTypes['profiles'];
    skills: DatabaseTypes['skills'];
  };
  tickets: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    assigned_to: string | null;
    created_at: string;
    resolved_at: string | null;
  };
  kb_articles: {
    id: string;
    title: string;
    content: string;
    category_id: string;
    author_id: string;
    created_at: string;
    updated_at: string;
    is_published: boolean;
    deleted: boolean;
  };
}

// Define base context types that all requests might need
const BaseContextSchema = z.object({
  vectorResults: z.array(z.object({
    id: z.string(),
    content: z.string(),
    metadata: z.record(z.any()),
    similarity: z.number()
  })).optional(),
  relatedDocuments: z.array(z.object({
    id: z.string(),
    title: z.string().optional(),
    content: z.string(),
    document_type: z.string(),
    metadata: z.record(z.any())
  })).optional()
});

// Define context schemas for different request types
const TeamContextSchema = BaseContextSchema.extend({
  existingTeams: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    similarity: z.number(),
    member_count: z.number().optional()
  })),
  relevantSkills: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    description: z.string().optional()
  })),
  qualifiedAgents: z.array(z.object({
    id: z.string(),
    full_name: z.string(),
    proficiency_level: z.number(),
    current_teams: z.array(z.string()).optional()
  }))
});

const TicketContextSchema = BaseContextSchema.extend({
  relevantTickets: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    priority: z.string(),
    assigned_to: z.string().nullable(),
    similarity: z.number()
  })),
  requiredSkills: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.string(),
    description: z.string().optional()
  })),
  agentInfo: z.object({
    id: z.string().uuid(),
    name: z.string(),
    role: z.string(),
    specialties: z.array(z.object({
      skill: z.string(),
      category: z.string(),
      proficiency: z.number()
    })),
    currentWorkload: z.object({
      active_tickets: z.number(),
      priority_distribution: z.record(z.string(), z.number()),
      avg_resolution_time: z.number().optional()
    })
  }).optional(),
  categoryPatterns: z.array(z.object({
    category: z.string(),
    avg_resolution_time: z.number(),
    common_solutions: z.array(z.string())
  }))
});

const ArticleContextSchema = BaseContextSchema.extend({
  similarArticles: z.array(z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
    category_id: z.string().uuid().optional(),
    author_id: z.string().uuid().optional(),
    is_published: z.boolean().optional(),
      similarity: z.number()
    })),
  categoryStats: z.object({
    total_articles: z.number(),
    avg_length: z.number(),
    last_updated: z.string()
  }).optional(),
  resolvedCategory: z.object({
    id: z.string().uuid(),
    name: z.string()
  }).optional()
});

// Add schema after ArticleContextSchema
const SkillContextSchema = BaseContextSchema.extend({
  vectorResults: z.array(z.object({
    id: z.string(),
    content: z.string(),
    metadata: z.record(z.any()),
    similarity: z.number()
  })).optional(),
  relatedDocuments: z.array(z.object({
    id: z.string(),
    title: z.string().optional(),
    content: z.string(),
    document_type: z.string(),
    metadata: z.record(z.any())
  })).optional(),
  relevantSkills: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.string(),
    description: z.string().optional(),
    proficiency_level: z.number().min(1).max(5).optional()
  })),
  ticket: z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    priority: z.string(),
    assigned_to: z.string().nullable()
  }).optional(),
  agentInfo: z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    specialties: z.array(z.string()),
    currentWorkload: z.object({
      active_tickets: z.number(),
      avg_resolution_time: z.number().optional()
    })
  }).optional()
});

const RAGOutputSchema = z.object({
  request: ProcessedInputSchema,
  context: z.union([TeamContextSchema, TicketContextSchema, ArticleContextSchema, SkillContextSchema])
});

type RAGOutput = z.infer<typeof RAGOutputSchema>;
type DatabaseTeam = { id: string; name: string; description: string | null; member_count: number };
type DatabaseSkill = { id: string; name: string; category: string; description: string | null };
type DatabaseAgent = { 
  user_id: string; 
  profiles: { id: string; full_name: string }; 
  proficiency_level: number;
  teams: { team_id: string }[];
};

export class RAGAgent implements BaseAgent {
  name = "RAG Agent";
  description = "Retrieves relevant context based on request type";

  // Cache for vector results and related documents
  private cache = {
    vectorResults: new Map<string, { timestamp: number, data: any[] }>(),
    relatedDocs: new Map<string, { timestamp: number, data: any[] }>(),
    CACHE_TTL: 5 * 60 * 1000 // 5 minutes in milliseconds
  };

  constructor(
    private llm: ChatModel,
    private supabase: SupabaseClient,
    private embeddings: OpenAIEmbeddings = new OpenAIEmbeddings()
  ) {}

  private getCacheKey(input: ProcessedInput): string {
    // Create a deterministic cache key from input fields
    const relevantFields = {
      target: input.target,
      name: input.name,
      description: input.description,
      memberCriteria: input.memberCriteria,
      criteria: input.criteria
    };
    return JSON.stringify(relevantFields);
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cache.CACHE_TTL;
  }

  async process(input: ProcessedInput): Promise<string> {
    try {
      console.group('📚 RAG Agent - Starting Process');
      console.log('Step 1: Processing input:', JSON.stringify(input, null, 2));

      // First get any relevant vector search results
      console.group('Step 2: Getting vector search results');
      const vectorResults = await this.getVectorResults(input);
      console.log('Vector Results:', JSON.stringify(vectorResults, null, 2));
      console.groupEnd();

      // Get related documents only for non-skill targets
      let relatedDocuments = [];
      if (input.target !== 'skill') {
        console.group('Step 3: Getting related documents');
        relatedDocuments = await this.getRelatedDocuments(input);
        console.log('Related Documents:', JSON.stringify(relatedDocuments, null, 2));
        console.groupEnd();
      }

      // Then get context based on request type
      console.group('Step 4: Getting context based on target type');
      console.log('Target type:', input.target);
      let context;
      switch (input.target) {
        case 'team':
          console.log('Getting team context...');
          context = await this.getTeamContext(input, vectorResults, relatedDocuments);
          break;
        case 'ticket':
          console.log('Getting ticket context...');
          context = await this.getTicketContext(input, vectorResults, relatedDocuments);
          break;
        case 'kb_article':
          console.log('Getting article context...');
          context = await this.getArticleContext(input, vectorResults, relatedDocuments);
          break;
        case 'skill':
          console.log('Getting skill context...');
          context = await this.getSkillContext(input);
          break;
        default:
          throw new Error(`Unsupported target type: ${input.target}`);
      }
      console.log('Context retrieved:', JSON.stringify(context, null, 2));
      console.groupEnd();

      // Prepare final output
      console.group('Step 5: Preparing final output');
      const output: RAGOutput = {
        request: input,
        context
      };
      console.log('Final RAG Output:', JSON.stringify(output, null, 2));
      console.groupEnd();

      console.groupEnd();
      return JSON.stringify(output);
    } catch (error) {
      console.error('❌ RAG processing failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async getVectorResults(input: ProcessedInput) {
    console.group('🔍 RAG Agent - Getting Vector Results');
    console.log('Step 1: Processing input for vector search:', input);

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(input);
      const cachedResults = this.cache.vectorResults.get(cacheKey);
      if (cachedResults && this.isCacheValid(cachedResults.timestamp)) {
        console.log('Cache hit for vector results');
        console.groupEnd();
        return cachedResults.data;
      }

      // Build search query from input fields
      const searchTerms = [
        input.name,
        input.description,
        input.memberCriteria,
        input.criteria?.category
      ].filter(Boolean);

      // If we have no meaningful search terms, use target-specific defaults
      if (searchTerms.length === 0) {
        console.log('No search terms found, using defaults for target:', input.target);
        switch (input.target) {
          case 'ticket':
            searchTerms.push('support ticket issue');
            break;
          case 'kb_article':
            searchTerms.push('knowledge base article');
            break;
          case 'team':
            searchTerms.push('team support');
            break;
        }
      }

      const searchQuery = searchTerms.join(' ');
      console.log('Step 2: Constructed search query:', searchQuery);

      // First try vector search without filter
      console.group('Step 3: Performing vector search');
      const vectorResults = await vectorStore.similaritySearch(searchQuery, 5);
      console.log('Vector search results:', vectorResults);
      console.groupEnd();

      // Then supplement with database search
      console.group('Step 4: Performing database search');
      const { data: documents, error: dbError } = await this.supabase
        .from('ai_documents')
        .select('id, content, metadata, document_type, title')
        .eq('document_type', input.target)
        .textSearch('content', searchQuery, {
          type: 'plain',  // Changed from default to plain for simpler matching
          config: 'english'
        })
        .limit(5);

      if (dbError) {
        console.error('Database search error:', dbError);
        console.error('Error details:', {
          code: dbError.code,
          message: dbError.message,
          details: dbError.details
        });
      }
      console.log('Database search results:', documents);
      console.groupEnd();

      // Combine and deduplicate results, filtering by target type
      console.group('Step 5: Combining and deduplicating results');
      const combined = [
        ...vectorResults
          .filter(doc => doc.metadata.document_type === input.target)
          .map(doc => ({
            id: doc.metadata.id,
            content: doc.pageContent,
            metadata: doc.metadata,
            similarity: doc.metadata.score || 0.5
          })),
        ...(documents || []).map(doc => ({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          similarity: 0.5
        }))
      ];

      // Deduplicate by ID
      const seen = new Set();
      const results = combined.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      console.log('Final combined and deduplicated results:', results);
      console.groupEnd();

      // Cache the results before returning
      this.cache.vectorResults.set(cacheKey, {
        timestamp: Date.now(),
        data: results
      });

      return results;
    } catch (error) {
      console.error('❌ Error in getVectorResults:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async getRelatedDocuments(input: ProcessedInput) {
    console.group('📄 RAG Agent - Getting Related Documents');
    console.log('Step 1: Input:', input);

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(input);
      const cachedDocs = this.cache.relatedDocs.get(cacheKey);
      if (cachedDocs && this.isCacheValid(cachedDocs.timestamp)) {
        console.log('Cache hit for related documents');
        console.groupEnd();
        return cachedDocs.data;
      }

      // Format search terms for tsquery
      const searchTerms = [
        input.name,
        input.description,
        input.memberCriteria,
        input.criteria?.category
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        // Split into words and filter out stop words and special characters
        .split(/\s+/)
        .filter(term => term.length > 2)
        // Format each term for tsquery
        .map(term => term.replace(/[^a-z0-9]/g, '') + ':*')
        .join(' & ');

      console.log('Query parameters:', {
        table: 'ai_documents',
        searchFields: 'content',
        searchTerm: searchTerms,
        filters: { document_type: input.target }
      });

      const { data, error, count } = await this.supabase
        .from('ai_documents')
        .select('id, title, content, document_type, metadata')
        .eq('document_type', input.target)
        .textSearch('content', searchTerms, {
          type: 'websearch',
          config: 'english'
        })
        .limit(5);

      if (error) {
        console.error('Database Error:', error);
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('Error Details:', error.details);
        throw error;
      }

      console.log('Query Response:', {
        data,
        count,
        hasData: !!data && data.length > 0
      });

      // Cache the results before returning
      this.cache.relatedDocs.set(cacheKey, {
        timestamp: Date.now(),
        data: data || []
      });

      return data || [];
    } catch (error) {
      console.error('❌ Error in getRelatedDocuments:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async getTeamContext(input: ProcessedInput, vectorResults?: any[], relatedDocs?: any[]) {
    const [existingTeams, relevantSkills, qualifiedAgents] = await Promise.all([
      this.findSimilarTeams(input.name || ''),
      this.findRelevantSkills(input.memberCriteria || ''),
      this.findQualifiedAgents(input.memberCriteria || '')
    ]);

    return TeamContextSchema.parse({
      vectorResults,
      relatedDocuments: relatedDocs,
      existingTeams,
      relevantSkills,
      qualifiedAgents
    });
  }

  private async findTicketByTitle(title: string): Promise<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assigned_to: string | null;
    similarity: number;
  } | null> {
    if (!title) return null;

    console.group('🎫 RAG Agent - Finding Ticket by Title');
    console.log('Original title:', title);

    // Clean up the title by removing the word "ticket" and trimming whitespace
    const cleanTitle = title.toLowerCase().replace(/\s*ticket\s*/g, ' ').trim();
    console.log('Cleaned title for search:', cleanTitle);

    try {
      const { data, error } = await this.supabase
        .from('tickets')
        .select('id, title, description, status, priority, assigned_to')
        .ilike('title', `%${cleanTitle}%`)
        .limit(1)
        .single();

      if (error) {
        console.error('Error finding ticket by title:', error);
        return null;
      }

      console.log('Found ticket:', data);
      console.groupEnd();
      return {
        ...data,
        similarity: 1 // Exact match since we found it by title
      };
    } catch (error) {
      console.error('Error in findTicketByTitle:', error);
      console.groupEnd();
      return null;
    }
  }

  private async getTicketContext(input: ProcessedInput, vectorResults?: any[], relatedDocs?: any[]) {
    console.group('🎫 RAG Agent - Getting Ticket Context');
    console.log('Step 1: Processing input:', input);

    try {
      // First, try to find the specific ticket if we have a name or ID
      let relevantTickets: Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        assigned_to: string | null;
        similarity: number;
      }> = [];

      // For reassignment, we need a ticket title
      if (input.action === 'reassign' && !input.name && !input.criteria?.title) {
        throw new Error('Ticket title is required for reassignment. Please specify the ticket title.');
      }

      if (input.name || input.criteria?.title) {
        const ticketTitle = (input.name || input.criteria?.title || '').toString();
        const ticket = await this.findTicketByTitle(ticketTitle);
        if (ticket) {
          relevantTickets = [ticket];
          console.log('Found ticket by title:', ticket);
        } else {
          const errorMessage = input.action === 'reassign' 
            ? `Could not find ticket with title "${ticketTitle}" for reassignment` 
            : `Could not find ticket with title: ${ticketTitle}`;
          console.warn(errorMessage);
          if (input.action === 'reassign') {
            throw new Error(errorMessage);
          }
        }
      }

      // Prepare all promises for parallel execution
      const contextPromises = {
        skills: input.memberCriteria ? 
          this.findRelevantSkills(input.memberCriteria) : 
          Promise.resolve([]),
        agent: input.assignee ? 
          this.getAgentInfo(input.assignee) : 
          Promise.resolve(undefined),
        patterns: input.criteria?.category ? 
          this.findCategoryPatterns(input.criteria.category) : 
          Promise.resolve([])
      };

      // Execute all promises in parallel
      console.group('Step 2: Fetching context data in parallel');
      const [requiredSkills, agentInfo, categoryPatterns] = await Promise.all([
        contextPromises.skills,
        contextPromises.agent,
        contextPromises.patterns
      ]);
      console.log('All context data fetched');
      console.groupEnd();

      // For reassignment operations, ensure we have a valid ticket and agent
      if (input.action === 'reassign') {
        if (!relevantTickets.length) {
          throw new Error('Ticket not found for reassignment');
        }
        if (!agentInfo) {
          throw new Error(`Agent not found with name: ${input.assignee}`);
        }
        console.log('Reassignment context:', {
          ticket: relevantTickets[0],
          agent: { id: agentInfo.id, name: agentInfo.name }
        });
      }

      // Format the context
      console.group('Step 3: Formatting context');
      const context = TicketContextSchema.parse({
        vectorResults,
        relatedDocuments: relatedDocs,
        relevantTickets,
        requiredSkills: requiredSkills.map(skill => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          description: skill.description
        })),
        agentInfo: agentInfo ? {
          id: agentInfo.id,
          name: agentInfo.name,
          role: agentInfo.role,
          specialties: agentInfo.specialties,
          currentWorkload: agentInfo.currentWorkload
        } : undefined,
        categoryPatterns,
        // If we found a specific ticket, include it in the ticket field
        ticket: relevantTickets[0] || undefined
      });
      console.log('Context formatted successfully');
      console.groupEnd();

      console.groupEnd();
      return context;
    } catch (error) {
      console.error('❌ Error in getTicketContext:', error);
      console.groupEnd();
      throw new Error(`Failed to get ticket context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getArticleContext(input: ProcessedInput, vectorResults?: any[], relatedDocs?: any[]) {
    console.group('📚 RAG Agent - Getting Article Context');
    console.log('Step 1: Processing input:', input);

    try {
      // First, if we have a category name, look up the category_id
      let category_id;
      if (input.criteria?.category) {
        console.log('Looking up category ID for:', input.criteria.category);
        const { data: categories, error: categoryError } = await this.supabase
          .from('kb_categories')
          .select('id, name')
          .ilike('name', input.criteria.category)
          .limit(1)
          .single();

        if (categoryError) {
          console.error('Category lookup error:', categoryError);
        } else if (categories) {
          category_id = categories.id;
          console.log('Found category ID:', category_id);
        }
      }

      // Get similar articles using plain text search
      const searchQuery = [input.name, input.description].filter(Boolean).join(' ');
      const { data: similarArticles, error: searchError } = await this.supabase
        .from('kb_articles')
        .select('id, title, content, category_id, author_id, updated_at, is_published')
        .eq('deleted', false)
        .textSearch('title || content', searchQuery, {
          type: 'plain',  // Changed from default to plain for simpler matching
          config: 'english'
        })
        .limit(5);

      if (searchError) {
        console.error('Article search error:', searchError);
        console.error('Error details:', {
          code: searchError.code,
          message: searchError.message,
          details: searchError.details
        });
      }

      // Get category stats if needed (wrapped in try/catch since RPC might not exist)
      let categoryStats;
      try {
        const { data: stats } = await this.supabase
          .from('kb_articles')
          .select('count')
          .eq('deleted', false)
          .single();
          
        if (stats?.count) {
          categoryStats = {
            total_articles: parseInt(String(stats.count), 10),
            avg_length: 0, // Computed server-side if needed
            last_updated: new Date().toISOString()
          };
        }
      } catch (error) {
        console.warn('Failed to get category stats:', error);
        // Continue without category stats
      }

      const context = {
        vectorResults,
        relatedDocuments: relatedDocs,
        similarArticles: similarArticles?.map(article => ({
          ...article,
          similarity: 0.5 // Default similarity score for text search results
        })) || [],
        categoryStats,
        // Add the resolved category_id to the context
        resolvedCategory: category_id ? {
          id: category_id,
          name: input.criteria?.category
        } : undefined
      };

      console.log('Article context:', context);
      return ArticleContextSchema.parse(context);
    } catch (error) {
      console.error('❌ Error in getArticleContext:', error);
      throw error;
    }
  }

  private async findSimilarTeams(teamName: string): Promise<DatabaseTypes['teams'][]> {
    const { data: teams } = await this.supabase
      .from('teams')
      .select(`
        id,
        name,
        description,
        is_active,
        member_count:team_members!team_id(count)
      `)
      .textSearch('name', teamName)
      .eq('is_active', true)
      .limit(5);

    return (teams || []).map(team => ({
      ...team,
      member_count: team.member_count?.[0]?.count || 0,
      similarity: this.calculateSimilarity(teamName, team.name)
    }));
  }

  private async findRelevantSkills(criteria: string): Promise<DatabaseSkill[]> {
    console.group('🔍 RAG Agent - Finding Relevant Skills');
    console.log('Step 1: Search criteria:', criteria);

    try {
      // Use ilike for case-insensitive matching
      const { data: skills, error } = await this.supabase
        .from('skills')
        .select('id, name, category, description')
        .ilike('name', `%${criteria}%`)
        .eq('is_active', true);

      if (error) {
        console.error('Database Error:', error);
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('Error Details:', error.details);
        throw error;
      }

      console.log('Query Response:', {
        data: skills,
        hasData: !!skills && skills.length > 0
      });

      if (!skills || skills.length === 0) {
        console.log('No skills found for criteria:', criteria);
        return [];
      }

      console.group('Step 3: Formatting skills');
      const formattedSkills = skills.map(skill => ({
        id: skill.id,
        name: skill.name,
        category: skill.category.toLowerCase(), // Normalize category to lowercase
        description: skill.description,
        type: 'skill',
        metadata: {
          subType: 'required',
          format: 'uuid'
        }
      }));
      console.log('Formatted skills:', JSON.stringify(formattedSkills, null, 2));
      console.groupEnd();

      console.groupEnd();
      return formattedSkills;
    } catch (error) {
      console.error('❌ Error in findRelevantSkills:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async findQualifiedAgents(skillCriteria: string): Promise<Array<{
    id: string;
    full_name: string;
    proficiency_level: number;
    current_teams: string[];
  }>> {
    interface QualifiedAgentResult {
      user_id: string;
      proficiency_level: number;
      profiles: {
        id: string;
        full_name: string;
        is_active: boolean;
      };
      teams: Array<{
        team_id: string;
        teams: {
          is_active: boolean;
        };
      }>;
    }

    // First find the relevant skill IDs
    const { data: skills } = await this.supabase
      .from('skills')
      .select('id')
      .textSearch('name || description', skillCriteria)
      .eq('is_active', true)
      .limit(1);

    if (!skills?.length) return [];

    // Then find agents with those skills
    const { data } = await this.supabase
      .from('user_skills')
      .select(`
        user_id,
        proficiency_level,
        profiles:user_id!inner (
          id,
          full_name,
          is_active
        ),
        teams:team_members!inner (
          team_id,
          teams!inner (
            is_active
          )
        )
      `)
      .eq('skill_id', skills[0].id)
      .eq('profiles.is_active', true)
      .order('proficiency_level', { ascending: false })
      .limit(10);

    const agents = data as unknown as QualifiedAgentResult[];
    
    return (agents || []).map(agent => ({
      id: agent.user_id,
      full_name: agent.profiles.full_name,
      proficiency_level: agent.proficiency_level,
      current_teams: agent.teams
        .filter((t: { teams: { is_active: boolean } }) => t.teams.is_active)
        .map((t: { team_id: string }) => t.team_id)
    }));
  }

  private async getAgentInfo(agentName: string) {
    console.group('👤 RAG Agent - Getting Agent Info');
    console.log('Looking up agent by name:', agentName);

    try {
      // Get just the basic agent info without any joins
      const { data, error } = await this.supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('full_name', agentName)
        .eq('is_active', true)
        .eq('role', 'agent')
        .single();

      if (error) {
        console.error('Supabase query error:', error);
        console.groupEnd();
        return undefined;
      }

      console.log('Query response:', data);

      if (!data) {
        console.warn('No agent found with name:', agentName);
        console.groupEnd();
        return undefined;
      }

      // Return simplified agent info
      const result = {
        id: data.id,
        name: data.full_name,
        role: data.role,
        specialties: [],
        currentWorkload: {
          active_tickets: 0,
          priority_distribution: {
            low: 0,
            medium: 0,
            high: 0,
            urgent: 0
          },
          avg_resolution_time: undefined
        }
      };

      console.log('Processed agent info:', result);
      console.groupEnd();
      return result;
    } catch (error) {
      console.error('Error getting agent info:', error);
      console.groupEnd();
      throw error;
    }
  }

  private calculatePriorityDistribution(tickets: Array<{ priority: 'low' | 'medium' | 'high' | 'urgent' }>): Record<'low' | 'medium' | 'high' | 'urgent', number> {
    const distribution: Record<'low' | 'medium' | 'high' | 'urgent', number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0
    };
    
    tickets.forEach(t => {
      distribution[t.priority]++;
    });
    
    return distribution;
  }

  private async calculateSimilarity(text1: string | null | undefined, text2: string | null | undefined): Promise<number> {
    // Handle null/undefined inputs
    if (!text1 || !text2) return 0;
    
    try {
      // Get embeddings for both texts
      const embedding1 = await this.embeddings.embedQuery(text1);
      const embedding2 = await this.embeddings.embedQuery(text2);

      // Calculate cosine similarity
      return this.cosineSimilarity(embedding1, embedding2);
    } catch (error) {
      console.error('Error calculating embedding similarity:', error);
      // Fallback to Jaccard similarity if embedding fails
      return this.jaccardSimilarity(text1, text2);
    }
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (norm1 * norm2);
  }

  private jaccardSimilarity(text1: string, text2: string): number {
    // Handle empty strings
    if (!text1.trim() || !text2.trim()) return 0;
    
    // Tokenize and create sets
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));

    // Calculate intersection and union
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    // Return Jaccard similarity
    return intersection.size / union.size;
  }

  private async findCategoryPatterns(category: string): Promise<Array<{
    category: string;
    avg_resolution_time: number;
    common_solutions: string[];
  }>> {
    console.group('📊 RAG Agent - Finding Category Patterns');
    console.log('Category:', category);

    try {
      if (!category) {
        console.log('No category provided, returning empty patterns');
        console.groupEnd();
        return [];
      }

      const { data: tickets, error } = await this.supabase
        .from('tickets')
        .select(`
          id,
          category,
          created_at,
          resolved_at,
          ticket_notes!inner (
            content
          )
        `)
        .eq('category', category)
        .eq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Database error in findCategoryPatterns:', error);
        throw error;
      }

      if (!tickets?.length) {
        console.log('No resolved tickets found for category:', category);
        console.groupEnd();
        return [{
          category,
          avg_resolution_time: 0,
          common_solutions: ['No historical data available for this category']
        }];
      }

      // Calculate average resolution time
      const resolutionTimes = tickets
        .map(t => t.resolved_at && new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime())
        .filter((time): time is number => time !== null && !isNaN(time));

      const avgResolutionTime = resolutionTimes.length > 0
        ? resolutionTimes.reduce((acc, time) => acc + time, 0) / resolutionTimes.length
        : 0;

      // Extract common solutions from notes
      const solutions = tickets
        .flatMap(t => t.ticket_notes)
        .map(n => n.content)
        .filter(c => c?.toLowerCase().includes('solution') || c?.toLowerCase().includes('resolved'))
        .slice(0, 5);

      const result = [{
        category,
        avg_resolution_time: avgResolutionTime,
        common_solutions: solutions.length > 0 ? solutions : ['No solution patterns found']
      }];

      console.log('Category patterns found:', result);
      console.groupEnd();
      return result;
    } catch (error) {
      console.error('Error in findCategoryPatterns:', error);
      console.groupEnd();
      throw new Error(`Failed to find category patterns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getSkillContext(input: ProcessedInput) {
    console.group('🎯 RAG Agent - Getting Skill Context');
    console.log('Step 1: Processing input:', input);

    try {
      // Find relevant skills first
      const relevantSkills = await this.findRelevantSkills(input.memberCriteria || '');
      if (!relevantSkills.length) {
        throw new Error(`Could not find skill matching criteria: ${input.memberCriteria}`);
      }
      console.log('Found skills:', relevantSkills);

      // For ticket-related skill operations, ticket lookup is mandatory
      if ((input.action === 'add' || input.action === 'reassign') && !input.criteria?.user_id) {
        const ticketTitle = input.criteria?.ticketTitle || input.criteria?.title;
        if (!ticketTitle) {
          throw new Error('Ticket title is required when adding skills to tickets or reassigning tickets');
        }
        
        const ticket = await this.findTicketByTitle(ticketTitle as string);
        if (!ticket) {
          throw new Error(`Could not find ticket with title: ${ticketTitle}`);
        }
        console.log('Found ticket:', ticket);

        // For reassignment, we need agent info
        let agentInfo;
        if (input.action === 'reassign' && input.assignee) {
          agentInfo = await this.getAgentInfo(input.assignee);
          if (!agentInfo) {
            throw new Error(`Could not find agent with name: ${input.assignee}`);
          }
          console.log('Found agent:', agentInfo);
        }

        return SkillContextSchema.parse({
          relevantSkills: relevantSkills.map(skill => ({
            id: skill.id,
            name: skill.name,
            category: skill.category,
            description: skill.description || undefined,
            proficiency_level: input.criteria?.proficiency_level || 2
          })),
          ticket: {
            id: ticket.id,
            title: ticket.title,
            description: ticket.description,
            status: ticket.status,
            priority: ticket.priority,
            assigned_to: ticket.assigned_to
          },
          agentInfo: agentInfo ? {
            id: agentInfo.id,
            name: agentInfo.name,
            role: agentInfo.role,
            specialties: agentInfo.specialties,
            currentWorkload: agentInfo.currentWorkload
          } : undefined
        });
      }
      
      // For user-related skill operations
      return SkillContextSchema.parse({
        relevantSkills: relevantSkills.map(skill => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          description: skill.description || undefined,
          proficiency_level: input.criteria?.proficiency_level || 2
        }))
      });
    } catch (error) {
      console.error('❌ Error in getSkillContext:', error);
      console.groupEnd();
      throw error;
    }
  }
} 
