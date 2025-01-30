/**
 * Represents a document stored in the AI vector store
 */
export interface AIDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
  document_type: 'kb_article' | 'ticket' | 'team';
  reference_id?: string;
  title?: string;
} 