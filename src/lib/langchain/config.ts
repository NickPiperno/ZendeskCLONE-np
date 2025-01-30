import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";
import { Client } from "langsmith";
import { LangChainTracer } from "langchain/callbacks";

if (!import.meta.env.VITE_SUPABASE_URL) throw new Error('Missing Supabase URL');
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) throw new Error('Missing Supabase key');
if (!import.meta.env.VITE_OPENAI_API_KEY) throw new Error('Missing OpenAI key');
if (!import.meta.env.VITE_LANGSMITH_API_KEY) throw new Error('Missing LangSmith API key');

// Initialize LangSmith client
export const langsmithClient = new Client({
  apiUrl: import.meta.env.VITE_LANGSMITH_ENDPOINT,
  apiKey: import.meta.env.VITE_LANGSMITH_API_KEY,
});

// Enable tracing if configured
export const ENABLE_TRACING = import.meta.env.VITE_LANGSMITH_TRACING === 'true';
export const PROJECT_NAME = import.meta.env.VITE_LANGSMITH_PROJECT || 'Zendesk';

// Create LangChain tracer
export const tracer = new LangChainTracer({
  projectName: PROJECT_NAME,
  client: langsmithClient
});

// Initialize Supabase client with explicit headers
const client = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false, // Since we're using anon key
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    }
  }
);

// Initialize OpenAI embeddings with explicit API key
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY
});

// Initialize vector store with explicit options
export const vectorStore = new SupabaseVectorStore(embeddings, {
  client,
  tableName: 'ai_documents',
  queryName: 'match_documents',
  filter: {} // Add any default filters if needed
});

// Add types for our document structure
export interface AIDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
  document_type: 'kb_article' | 'ticket' | 'team';
  reference_id?: string;
  title?: string;
} 