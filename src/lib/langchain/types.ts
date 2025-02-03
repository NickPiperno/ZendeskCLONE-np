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

// Define AgentInfo type
export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  specialties: Array<{
    skill: string;
    category: string;
    proficiency: number;
  }>;
  currentWorkload: {
    active_tickets: number;
    priority_distribution: Record<string, number>;
    avg_resolution_time?: number;
  };
}

export interface RAGContext {
  domain: 'kb' | 'ticket' | 'team';
  similarTickets: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    assigned_to: string | null;
    similarity?: number;
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
  requiredSkills?: Array<{
    id: string;
    name: string;
    category: string;
    description?: string;
  }>;
  resolvedCategory?: {
    id: string;
    name: string;
  };
  vectorResults?: Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    similarity: number;
  }>;
  relatedDocuments?: Array<{
    id: string;
    title?: string;
    content: string;
    document_type: string;
    metadata: Record<string, any>;
  }>;
  existingTeams?: Array<{
    id: string;
    name: string;
    description?: string;
    similarity: number;
    member_count?: number;
  }>;
  qualifiedAgents?: Array<{
    id: string;
    full_name: string;
    proficiency_level: number;
    current_teams?: string[];
  }>;
  ticket?: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assigned_to: string | null;
  };
  agentInfo?: AgentInfo;
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