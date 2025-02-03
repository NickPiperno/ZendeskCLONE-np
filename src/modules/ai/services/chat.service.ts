import { ChatMessage, ChatResponse, ChatRole } from '../types/chat.types';
import { InputProcessorAgent, ProcessedInputSchema } from '@/lib/langchain/agents/input-processor-agent';
import { chatModel } from '@/lib/langchain/agents';
import { TaskRouterAgent } from '@/lib/langchain/agents/task-router-agent';
import { ExecutionAgent } from '@/lib/langchain/agents/execution-agent';
import { ResponseAgent } from '@/lib/langchain/agents/response-agent';
import { supabase } from '@/services/supabase';
import { vectorStore } from '@/lib/langchain/config';
import { RAGContext } from '../../../lib/langchain/types';
import { TicketAgent } from '@/lib/langchain/agents/ticket-agent';
import { KBAgent } from '@/lib/langchain/agents/kb-agent';
import { TeamAgent } from '@/lib/langchain/agents/team-agent';
import { z } from 'zod';
import { RAGAgent } from '@/lib/langchain/agents/rag-agent';

type ProcessedInput = z.infer<typeof ProcessedInputSchema>;

// Initialize agents
const inputProcessor = new InputProcessorAgent(chatModel);
const taskRouter = new TaskRouterAgent(chatModel);
const ticketAgent = new TicketAgent(chatModel);
const kbAgent = new KBAgent(chatModel);
const teamAgent = new TeamAgent(chatModel);
const executionAgent = new ExecutionAgent(chatModel, supabase);
const responseAgent = new ResponseAgent(chatModel);

export type ProcessingStepCallback = (step: string) => void;

export const sendMessage = async (message: string, onProcessingStep?: ProcessingStepCallback): Promise<ChatResponse> => {
  try {
    onProcessingStep?.('🤖 AI Chat Service - Processing Message');

    // 1. Process input with session context
    onProcessingStep?.('🎯 Processing input with Input Processor Agent');
    const rawProcessedInput = await inputProcessor.process(message);
    
    const processedInput: ProcessedInput = typeof rawProcessedInput === 'string' 
      ? JSON.parse(rawProcessedInput)
      : rawProcessedInput;

    // 2. Get relevant context from vector store
    onProcessingStep?.('🔍 Getting context from RAG agent');
    const ragAgent = new RAGAgent(chatModel, supabase);
    const ragResult = await ragAgent.process(processedInput).catch(error => {
      console.error('RAG agent processing failed:', error);
      throw error;
    });

    const parsedRagResult = typeof ragResult === 'string' 
      ? JSON.parse(ragResult)
      : ragResult;

    // Transform RAG results into context format
    const context: RAGContext = {
      domain: processedInput.target === 'ticket' ? 'ticket' : 
              processedInput.target === 'kb_article' ? 'kb' : 'team',
      similarTickets: parsedRagResult.context.relevantTickets || [],
      kbArticles: parsedRagResult.context.similarArticles || [],
      previousSolutions: parsedRagResult.context.categoryPatterns?.map((pattern: {
        category: string;
        common_solutions: string[];
      }) => ({
        id: pattern.category,
        solution: pattern.common_solutions.join('\n'),
        effectiveness: 1
      })) || [],
      requiredSkills: parsedRagResult.context.relevantSkills || parsedRagResult.context.requiredSkills || [],
      resolvedCategory: parsedRagResult.context.resolvedCategory,
      // Preserve original RAG context fields
      vectorResults: parsedRagResult.context.vectorResults,
      relatedDocuments: parsedRagResult.context.relatedDocuments,
      existingTeams: parsedRagResult.context.existingTeams,
      qualifiedAgents: parsedRagResult.context.qualifiedAgents,
      ticket: parsedRagResult.context.ticket
    };

    // 3. Route to appropriate domain agent using RAG agent output directly.
    onProcessingStep?.('🔄 Task Router Agent - Analyzing Request');
    const routingResult = await taskRouter.routeTask({
      query: message,
      entities: [], // No entity recognition output; using RAG agent context only.
      context
    });

    // 4. Process through domain agent
    onProcessingStep?.(`🔧 Processing through ${routingResult.targetAgent.toLowerCase()} agent`);
    let domainResult;
    switch (routingResult.targetAgent) {
      case 'TICKET_ACTION':
        domainResult = await ticketAgent.process({
          operation: routingResult.operation as any,
          parameters: routingResult.parameters,
          context: routingResult.context
        });
        break;
      case 'KB_ACTION':
        domainResult = await kbAgent.process({
          operation: routingResult.operation as any,
          parameters: routingResult.parameters,
          context: routingResult.context
        });
        break;
      case 'TEAM_ACTION':
        domainResult = await teamAgent.process({
          operation: routingResult.operation as any,
          parameters: routingResult.parameters,
          context: routingResult.context
        });
        break;
      default:
        throw new Error(`Unsupported target agent: ${routingResult.targetAgent}`);
    }

    const parsedDomainResult = typeof domainResult === 'string' 
      ? JSON.parse(domainResult) 
      : domainResult;

    // 5. Execute the validated operation through execution agent
    onProcessingStep?.('⚡ Executing operation');
    const executionResult = await executionAgent.process(parsedDomainResult);
    const parsedResult = typeof executionResult === 'string' 
      ? JSON.parse(executionResult)
      : executionResult;

    // 6. Format the response
    onProcessingStep?.('✨ Formatting response');
    const formattedResponse = await responseAgent.process({
      domain: routingResult.targetAgent === 'KB_ACTION' ? 'kb' :
              routingResult.targetAgent === 'TICKET_ACTION' ? 'ticket' : 'team',
      operation: routingResult.operation,
      result: parsedResult
    });

    const response = {
      message: {
        id: 'msg_' + Math.random().toString(36).substr(2, 9),
        content: formattedResponse,
        role: 'assistant' as ChatRole,
        timestamp: new Date().toISOString()
      }
    };

    return response;
  } catch (error) {
    console.error('Chat processing failed:', error);
    throw error;
  }
}; 