import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";
import type { AIDocument } from '../types';

if (!process.env.VITE_SUPABASE_URL) throw new Error('Missing Supabase URL');
if (!process.env.VITE_SUPABASE_ANON_KEY) throw new Error('Missing Supabase key');
if (!process.env.VITE_OPENAI_API_KEY) throw new Error('Missing OpenAI key');

const client = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Vector store instance for AI documents
 * Uses Supabase as the backend and OpenAI for embeddings
 * @type {SupabaseVectorStore} Stores and retrieves AIDocument instances
 */
export const vectorStore = new SupabaseVectorStore(
  new OpenAIEmbeddings(),
  {
    client,
    tableName: 'ai_documents',
    queryName: 'match_documents'
  }
);

/**
 * Helper function to add a document to the vector store
 * @param document The document to add
 */
export async function addDocument(document: Omit<AIDocument, 'embedding'>) {
  const { content, metadata, document_type, reference_id, title } = document;
  await vectorStore.addDocuments([
    {
      pageContent: content,
      metadata: {
        ...metadata,
        document_type,
        reference_id,
        title
      }
    }
  ]);
}

/**
 * Helper function to search for similar documents
 * @param query The search query
 * @param filter Optional filter criteria
 */
export async function searchSimilarDocuments(
  query: string,
  filter?: { document_type?: AIDocument['document_type'] }
) {
  return vectorStore.similaritySearch(query, 4, filter);
} 