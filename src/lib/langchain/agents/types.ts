import { ChatModel } from '../types';
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { AIMessageChunk } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";

// Interface for all agents
export interface BaseAgent {
  name: string;
  description: string;
  process(input: string | Record<string, any>): Promise<string>;
} 
