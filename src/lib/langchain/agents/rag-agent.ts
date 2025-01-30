import { BaseAgent } from './types';
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { vectorStore } from '../config';
import { ChatModel, RAGContext } from '../types';

// Define input schema (matches InputProcessorAgent output)
const RAGInputSchema = z.object({
  rawInput: z.string(),
  ticketRefs: z.array(z.string()),
  topic: z.string().optional(),
  requestType: z.string()
});

// Define output schema
const RAGOutputSchema = z.object({
  userRequest: RAGInputSchema,
  relevantContext: z.object({
    similarTickets: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      status: z.string(),
      priority: z.string().optional(),
      similarity: z.number()
    })),
    kbArticles: z.array(z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      category: z.string().optional(),
      similarity: z.number()
    })),
    previousSolutions: z.array(z.object({
      id: z.string(),
      solution: z.string(),
      effectiveness: z.number()
    }))
  })
});

type RAGInput = z.infer<typeof RAGInputSchema>;
type RAGOutput = {
  userRequest: RAGInput;
  relevantContext: RAGContext;
};

export class RAGAgent implements BaseAgent {
  name = "RAG Agent";
  description = "Retrieves and augments context for user queries";

  constructor(
    private llm: ChatModel,
    private supabase: SupabaseClient
  ) {}

  async process(input: string | RAGInput): Promise<string> {
    try {
      console.group('📚 RAG Agent');
      console.log('Input:', input);

      // Normalize input
      const ragInput = this.normalizeInput(input);
      console.log('Normalized Input:', ragInput);

      // Find similar tickets
      const similarTickets = await this.findSimilarTickets(ragInput);
      console.log('Similar Tickets:', similarTickets);

      // Find previous solutions
      const previousSolutions = await this.findPreviousSolutions(ragInput);
      console.log('Previous Solutions:', previousSolutions);

      // Retrieve context
      const context = await this.retrieveContext({
        rawInput: ragInput.rawInput,
        ticketRefs: ragInput.ticketRefs,
        similarTickets,
        previousSolutions
      });

      console.log('Final Context:', context);
      console.groupEnd();
      return JSON.stringify(context);
    } catch (error) {
      console.error('RAG processing failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  private normalizeInput(input: string | RAGInput): RAGInput {
    if (typeof input === 'string') {
      return {
        rawInput: input,
        ticketRefs: [],
        requestType: 'general',
        topic: undefined
      };
    }
    return input;
  }

  private async retrieveContext(input: {
    rawInput: string;
    ticketRefs: string[];
    similarTickets: RAGContext['similarTickets'];
    previousSolutions: RAGContext['previousSolutions'];
  }): Promise<RAGContext> {
    const [similarTickets, kbArticles, previousSolutions] = await Promise.all([
      this.findSimilarTickets({ 
        rawInput: input.rawInput,
        ticketRefs: input.ticketRefs,
        requestType: 'search',
        topic: undefined
      }),
      this.findRelevantKBArticles({ 
        rawInput: input.rawInput,
        ticketRefs: input.ticketRefs,
        requestType: 'search',
        topic: undefined
      }),
      input.previousSolutions || this.findPreviousSolutions({ 
        rawInput: input.rawInput,
        ticketRefs: input.ticketRefs,
        requestType: 'search',
        topic: undefined
      })
    ]);

    return {
      domain: 'ticket',
      similarTickets: input.similarTickets || similarTickets,
      kbArticles,
      previousSolutions
    };
  }

  private async findSimilarTickets(input: RAGInput): Promise<RAGContext['similarTickets']> {
    // Build search query from input
    const searchQuery = [
      input.topic,
      ...input.ticketRefs.map(ref => `ticket:${ref}`),
      input.requestType
    ].filter(Boolean).join(' ');

    // Search vector store for similar tickets
    const results = await vectorStore.similaritySearch(searchQuery, 5, {
      filter: { document_type: 'ticket' }
    });

    // Format results
    return results.map(doc => ({
      id: doc.metadata.id,
      title: doc.metadata.title,
      description: doc.pageContent,
      status: doc.metadata.status,
      priority: doc.metadata.priority,
      similarity: doc.metadata.score || 0
    }));
  }

  private async findRelevantKBArticles(input: RAGInput): Promise<RAGContext['kbArticles']> {
    // Build search query from input and any found similar tickets
    const searchQuery = input.topic || input.rawInput;

    // Search vector store for relevant KB articles
    const results = await vectorStore.similaritySearch(searchQuery, 3, {
      filter: { document_type: 'kb_article' }
    });

    // Format results
    return results.map(doc => ({
      id: doc.metadata.id,
      title: doc.metadata.title,
      content: doc.pageContent,
      category: doc.metadata.category,
      similarity: doc.metadata.score || 0
    }));
  }

  private async findPreviousSolutions(input: RAGInput): Promise<RAGContext['previousSolutions']> {
    // If we have ticket references, look for their solutions
    if (input.ticketRefs.length > 0) {
      const { data: solutions } = await this.supabase
        .from('ticket_solutions')
        .select('ticket_id, solution, effectiveness_score')
        .in('ticket_reference', input.ticketRefs);

      if (solutions) {
        return solutions.map(sol => ({
          id: sol.ticket_id,
          solution: sol.solution,
          effectiveness: sol.effectiveness_score
        }));
      }
    }

    // If no direct ticket references, search for solutions to similar tickets
    const searchQuery = input.topic || input.rawInput;
    const results = await vectorStore.similaritySearch(searchQuery, 3, {
      filter: { document_type: 'ticket_solution' }
    });

    return results.map(doc => ({
      id: doc.metadata.ticket_id,
      solution: doc.pageContent,
      effectiveness: doc.metadata.effectiveness_score
    }));
  }
} 
