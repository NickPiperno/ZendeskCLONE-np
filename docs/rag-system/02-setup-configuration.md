# Setup & Configuration

## Environment Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Supabase account and project
- OpenAI API key

### Environment Variables
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Vector Store Configuration
PGVECTOR_DIMENSION=1536  # OpenAI embedding dimension
```

## Dependencies

### Core Dependencies
```json
{
  "@supabase/supabase-js": "^2.x.x",
  "@langchain/openai": "^0.0.x",
  "langchain": "^0.1.x",
  "@pinecone-database/pinecone": "^1.x.x"
}
```

### Development Dependencies
```json
{
  "@types/node": "^20.x.x",
  "typescript": "^5.x.x",
  "ts-node": "^10.x.x"
}
```

## Configuration Options

### Vector Store Configuration
```typescript
// src/lib/langchain/config.ts
export const vectorStoreConfig = {
  dimension: 1536,  // OpenAI embedding dimension
  metric: 'cosine',  // Similarity metric
  indexName: 'documents',  // Vector store index name
  batchSize: 100  // Batch size for embeddings generation
}
```

### Query Configuration
```typescript
// src/lib/langchain/config.ts
export const queryConfig = {
  maxResults: 5,  // Maximum number of results to return
  minSimilarity: 0.7,  // Minimum similarity score
  contextWindow: 2000  // Context window size in tokens
}
```

### Response Generation Configuration
```typescript
// src/lib/langchain/config.ts
export const responseConfig = {
  temperature: 0.7,  // Response creativity (0-1)
  maxTokens: 500,  // Maximum response length
  model: 'gpt-3.5-turbo'  // OpenAI model to use
}
```

## Database Setup

### Vector Store Tables
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table with vector support
CREATE TABLE ai_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536)
);

-- Create vector index
CREATE INDEX ON ai_documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Metadata Tables
```sql
-- Create document metadata table
CREATE TABLE document_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES ai_documents(id),
  document_type TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing Configuration

### Test Data Generation
```typescript
// scripts/test-data-generation.ts
export const testConfig = {
  numTickets: 30,
  numKBArticles: 10,
  numTeams: 3,
  batchSize: 5
}
```

### Test Query Types
```typescript
// scripts/test-rag-workflow.ts
export const testQueries = {
  highPriority: 'What high priority issues need attention?',
  features: 'What feature requests do we have?',
  security: 'What security-related issues need attention?',
  performance: 'List all performance-related tickets'
} 