import { BaseMessage } from "@langchain/core/messages";
import { AgentAction, AgentFinish } from "@langchain/core/agents";
import { ChatOpenAI } from "@langchain/openai";
import { AIDocument } from "./config";

// Define ChatModel type
export type ChatModel = ChatOpenAI;

// Base agent interface
export interface BaseAgent {
  name: string;
  description: string;
  process(input: any): Promise<string>;
}

// Base input interface
export interface BaseAgentInput {
  verbose?: boolean;
  callbacks?: any[];
}

// Input processor types
export interface ProcessorAgentInput extends BaseAgentInput {
  inputText: string;
}

// RAG types
export interface RAGAgentInput extends BaseAgentInput {
  query: string;
  documentType?: AIDocument['document_type'];
}

export interface RAGContext {
  domain: 'kb' | 'ticket' | 'team';
  similarTickets: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
  }>;
  kbArticles: Array<{
    id: string;
    title: string;
    content: string;
  }>;
  previousSolutions: Array<{
    id: string;
    solution: string;
    effectiveness: number;
  }>;
}

// Entity recognition types
export interface EntityRecognitionInput extends BaseAgentInput {
  text: string;
  context?: RAGContext;
}

// Task router types
export interface TaskRouterInput extends BaseAgentInput {
  task: string;
  entities: Array<{
    type: string;
    value: string;
  }>;
  context?: RAGContext;
}

// Response types
export interface AgentResponse {
  output: string;
  intermediateSteps?: (AgentAction | AgentFinish)[];
  messages?: BaseMessage[];
}

export type DomainAgentType = 'kb' | 'ticket' | 'team'; 