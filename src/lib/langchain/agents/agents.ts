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
import { ProcessedInputSchema } from "./input-processor-agent";

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
  inputProcessor: new InputProcessorAgent(chatModel),  // Initialize with LLM support
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
    console.group('🎭 Agent Orchestrator');
    console.log('Input:', input);

    // Step 1: Process input
    const processedInput = await agents.inputProcessor.process(input);
    console.log('Processed Input:', processedInput);

    // Step 2: Get relevant context
    const parsedInput = ProcessedInputSchema.parse(JSON.parse(processedInput));
    const ragContext = await agents.rag.process(parsedInput);
    console.log('RAG Context:', ragContext);

    // Step 3: Extract entities
    const entities = await agents.entityRecognition.process(ragContext);
    console.log('Entities:', entities);

    // Step 4: Route to appropriate task
    const taskInput = {
      query: parsedInput.description || '',
      entities: JSON.parse(entities),
      context: JSON.parse(ragContext)
    };
    const task = await agents.taskRouter.process(taskInput);
    console.log('Task:', task);

    // Step 5: Execute task
    const result = await agents.execution.process(task);
    console.log('Result:', result);

    console.groupEnd();
    return result;
  } catch (error) {
    console.error('Agent orchestration failed:', error);
    console.groupEnd();
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