import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BaseMessage } from "@langchain/core/messages";
import { vectorStore } from "../config";
import { ENABLE_TRACING, PROJECT_NAME } from "../config";

// Create a chat model instance with tracing
export const chatModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
  ...(ENABLE_TRACING ? {
    tags: ["zendesk", "chat"],
    metadata: {
      project: PROJECT_NAME,
      model: "gpt-3.5-turbo"
    }
  } : {})
});

// Input processor agent prompt
const inputProcessorPrompt = PromptTemplate.fromTemplate(`
You are an input processing agent for a CRM system. Analyze the following user input
and determine the intent, entities, and required actions.

User Input: {input}

Provide a structured response with:
- Primary Intent
- Entities Detected
- Required Actions
- Target Agent (KB, Ticket, or Team)
`);

// Response formatter agent prompt
const responseFormatterPrompt = PromptTemplate.fromTemplate(`
Format the following AI response into a user-friendly message:

Raw Response: {response}

Format it to be:
1. Concise
2. Professional
3. Action-oriented
`);

// Helper functions for processing
export async function processInput(input: string): Promise<string> {
  const formattedPrompt = await inputProcessorPrompt.format({ input });
  const response = await chatModel.invoke(formattedPrompt);
  return response.content as string;
}

export async function formatResponse(response: string): Promise<string> {
  const formattedPrompt = await responseFormatterPrompt.format({ response });
  const aiResponse = await chatModel.invoke(formattedPrompt);
  return aiResponse.content as string;
}

// Export agent types
export type AgentType = 'kb' | 'ticket' | 'team';

// Export agents
export * from './entity-recognition-agent';
export * from './task-router-agent';
export * from './execution-agent';
export * from './response-agent'; 