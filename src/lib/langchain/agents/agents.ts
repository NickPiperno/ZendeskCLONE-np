import { BaseAgent } from "./types";
import { ChatModel } from "../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { ChatOpenAI } from "@langchain/openai";
import { supabase } from "../../../services/supabase";

// Import all agents
import { InputProcessorAgent } from "./input-processor-agent";
import { RAGAgent } from "./rag-agent";
import { EntityRecognitionAgent } from "./entity-recognition-agent";
import { TaskRouterAgent } from "./task-router-agent";
import { ticketAgent } from "./ticket-agent";  // Import the singleton instance
import { ExecutionAgent } from "./execution-agent";
import { AuditAgent } from "./audit-agent";
import { ResponseAgent } from "./response-agent";

// Create OpenAI instance for agents that need it
const chatModel: ChatModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0
});

// Map task operations to audit operations
const taskToAuditOperation = {
  'kb_search': 'SELECT',
  'kb_create': 'INSERT',
  'kb_update': 'UPDATE',
  'ticket_search': 'SELECT',
  'ticket_create': 'INSERT',
  'ticket_update': 'UPDATE',
  'team_search': 'SELECT',
  'team_assign': 'UPDATE',
  'team_skill_search': 'SELECT'
} as const;

// Create response agent first since audit agent depends on it
const responseAgent = new ResponseAgent(chatModel);

// Create agent instances
export const agents = {
  inputProcessor: new InputProcessorAgent(),
  rag: new RAGAgent(chatModel, supabase),  // Needs Supabase for vector search
  entityRecognition: new EntityRecognitionAgent(chatModel),
  taskRouter: new TaskRouterAgent(chatModel),
  ticket: ticketAgent,  // Use the imported singleton
  execution: new ExecutionAgent(chatModel, supabase),  // Needs Supabase for operations
  response: responseAgent,
  audit: new AuditAgent(supabase, responseAgent)  // Pass Supabase and response agent
};

// Interface for chain data
interface AgentChainData {
  userInput: string;
  processedInput?: string;
  context?: {
    domain: 'kb' | 'ticket' | 'team';
    similarTickets: any[];
    kbArticles: any[];
    previousSolutions: any[];
  };
  entities?: Array<{ type: string; value: string }>;
  taskRoute?: string;
  executionResult?: any;
  auditLog?: any;
  response?: string;
}

// Process input through the agent chain
export async function processAgentChain(input: string): Promise<string> {
  try {
    // Step 1: Process input
    const processedInput = await agents.inputProcessor.process(input);

    // Step 2: RAG retrieval
    const ragResult = await agents.rag.process(processedInput);
    const context = JSON.parse(ragResult);

    // Step 3: Entity recognition
    const entities = JSON.parse(await agents.entityRecognition.process(processedInput));

    // Step 4: Task routing
    const taskRoute = await agents.taskRouter.process({
      query: processedInput,
      entities,
      context
    });

    // Step 5: Execute task
    const executionResult = JSON.parse(await agents.execution.process(JSON.stringify({
      task: taskRoute,
      entities,
      context
    })));

    // Step 6: Audit
    const parsedTaskRoute = JSON.parse(taskRoute);
    await agents.audit.process({
      operation: taskToAuditOperation[parsedTaskRoute.operation as keyof typeof taskToAuditOperation] || 'SELECT',
      domain: context?.domain || 'ticket',
      changes: executionResult.changes || [],
      timestamp: new Date().toISOString(),
      metadata: {
        entities,
        context,
        executionResult
      }
    });

    // Step 7: Format response
    return await agents.response.process({
      domain: context?.domain || 'ticket',
      operation: taskRoute,
      result: executionResult,
      context
    });

  } catch (error) {
    console.error('Agent chain processing failed:', error);
    return `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Export individual agents for direct access if needed
export const {
  inputProcessor,
  rag,
  entityRecognition,
  taskRouter,
  ticket,
  execution,
  audit,
  response
} = agents; 