import { BaseMessage } from "@langchain/core/messages";
import { AgentAction, AgentFinish } from "@langchain/core/agents";

export interface BaseAgentInput {
  verbose?: boolean;
  callbacks?: any[];
}

export interface ProcessorAgentInput extends BaseAgentInput {
  inputText: string;
}

export interface RAGAgentInput extends BaseAgentInput {
  query: string;
  documentType?: 'kb_article' | 'ticket' | 'team';
}

export interface EntityRecognitionInput extends BaseAgentInput {
  text: string;
  context?: any[];
}

export interface TaskRouterInput extends BaseAgentInput {
  task: string;
  entities: Record<string, any>;
  context?: any[];
}

export type AgentResponse = {
  output: string;
  intermediateSteps?: (AgentAction | AgentFinish)[];
  messages?: BaseMessage[];
};

export type DomainAgentType = 'kb' | 'ticket' | 'team'; 