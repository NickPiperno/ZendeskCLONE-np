import { Client } from 'langsmith';

// Initialize LangSmith client
export const langsmithClient = new Client({
  apiUrl: import.meta.env.VITE_LANGSMITH_ENDPOINT,
  apiKey: import.meta.env.VITE_LANGSMITH_API_KEY,
});

// Project configuration
export const LANGSMITH_PROJECT = import.meta.env.VITE_LANGSMITH_PROJECT || 'Zendesk';

// Tracing configuration
export const ENABLE_TRACING = import.meta.env.VITE_LANGSMITH_TRACING === 'true';

// Tag configuration
export const DEFAULT_TAGS = ['zendesk', 'production'];

// Trace handlers
export const handleTraceStart = (trace: any) => {
  console.log(`Starting trace: ${trace.id}`);
};

export const handleTraceEnd = (trace: any) => {
  console.log(`Completed trace: ${trace.id}`);
  // Log any errors
  if (trace.error) {
    console.error(`Trace error: ${trace.error}`);
  }
  // Log performance metrics
  console.log(`Duration: ${trace.endTime - trace.startTime}ms`);
  console.log(`Tokens used: ${trace.tokenUsage?.totalTokens || 0}`);
};

// Utility function to create trace tags
export const createTraceTags = (additionalTags: string[] = []) => {
  return [...DEFAULT_TAGS, ...additionalTags];
}; 