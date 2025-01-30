import { ChatMessage, ChatResponse, ChatRole } from '../types/chat.types';
import { InputProcessorAgent } from '@/lib/langchain/agents/input-processor-agent';
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

interface ProcessedInput {
  text: string;
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  intent?: {
    name: string;
    confidence: number;
  };
}

// Initialize agents
const inputProcessor = new InputProcessorAgent();
const taskRouter = new TaskRouterAgent(chatModel);
const ticketAgent = new TicketAgent(chatModel);
const kbAgent = new KBAgent(chatModel);
const teamAgent = new TeamAgent(chatModel);
const executionAgent = new ExecutionAgent(chatModel, supabase);
const responseAgent = new ResponseAgent(chatModel);

export const sendMessage = async (message: string): Promise<ChatResponse> => {
  try {
    // 1. Process input with session context
    const rawProcessedInput = await inputProcessor.process(message);
    const processedInput: ProcessedInput = typeof rawProcessedInput === 'string' 
      ? JSON.parse(rawProcessedInput)
      : rawProcessedInput;

    // 2. Get relevant context from vector store
    const searchResults = await vectorStore.similaritySearch(message);
    
    // Transform search results into RAGContext format
    const context: RAGContext = {
      domain: 'ticket', // Default to ticket domain, will be refined by task router
      similarTickets: searchResults
        .filter(doc => doc.metadata.document_type === 'ticket')
        .map(doc => ({
          id: doc.metadata.id,
          title: doc.metadata.title || '',
          description: doc.pageContent,
          status: doc.metadata.status || 'unknown',
          priority: doc.metadata.priority || 'medium'
        })),
      kbArticles: searchResults
        .filter(doc => doc.metadata.document_type === 'kb_article')
        .map(doc => ({
          id: doc.metadata.id,
          title: doc.metadata.title || '',
          content: doc.pageContent
        })),
      previousSolutions: searchResults
        .filter(doc => doc.metadata.document_type === 'ticket_solution')
        .map(doc => ({
          id: doc.metadata.ticket_id,
          solution: doc.pageContent,
          effectiveness: doc.metadata.effectiveness_score || 0
        }))
    };

    // 3. Route to appropriate domain agent
    const routingResult = await taskRouter.routeTask({
      query: message,
      entities: processedInput.entities,
      context
    });

    // 4. Process through domain agent first
    let domainResult;
    switch (routingResult.targetAgent) {
      case 'TicketAgent':
        // Ensure operation is a valid ticket operation
        const ticketOperation = routingResult.operation as 'ticket_search' | 'ticket_create' | 'ticket_update';
        domainResult = await ticketAgent.process({
          operation: ticketOperation,
          parameters: routingResult.parameters,
          context: routingResult.context
        });
        break;
      case 'KBAgent':
        // Ensure operation is a valid KB operation
        const kbOperation = routingResult.operation as 'kb_search' | 'kb_create' | 'kb_update';
        domainResult = await kbAgent.process({
          operation: kbOperation,
          parameters: routingResult.parameters,
          context: routingResult.context
        });
        break;
      case 'TeamAgent':
        // Ensure operation is a valid team operation
        const teamOperation = routingResult.operation as 'team_search' | 'team_assign' | 'team_skill_search';
        domainResult = await teamAgent.process({
          operation: teamOperation,
          parameters: routingResult.parameters,
          context: routingResult.context
        });
        break;
      default:
        throw new Error(`Unsupported domain agent: ${routingResult.targetAgent}`);
    }

    // 5. Execute the validated operation
    const executionResult = await executionAgent.process(JSON.parse(domainResult));

    if (!executionResult) {
      throw new Error('Operation execution failed: No result returned');
    }

    // Parse the execution result
    let parsedResult;
    try {
      parsedResult = JSON.parse(executionResult);
    } catch (error) {
      console.error('Failed to parse execution result:', error);
      throw new Error('Operation execution failed: Invalid result format');
    }

    // 6. Format the response
    const formattedResponse = await responseAgent.process({
      domain: routingResult.domain,
      operation: routingResult.operation,
      result: parsedResult
    });

    return {
      message: {
        id: 'msg_' + Math.random().toString(36).substr(2, 9),
        content: formattedResponse,
        role: 'assistant' as ChatRole,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Chat processing failed:', error);
    throw error;
  }
}; 