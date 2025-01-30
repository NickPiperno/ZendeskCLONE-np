-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum for document types if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE document_type AS ENUM ('kb_article', 'ticket', 'team');
    END IF;
END $$;

-- Create the ai_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS ai_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536), -- OpenAI embeddings are 1536 dimensions
    document_type document_type NOT NULL,
    reference_id UUID NOT NULL, -- ID reference to the original document
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- Add unique constraint for ON CONFLICT support
    CONSTRAINT ai_documents_reference_id_document_type_key UNIQUE (reference_id, document_type)
);

-- Create trigger function to validate references if it doesn't exist
CREATE OR REPLACE FUNCTION validate_ai_document_reference()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if reference exists in the appropriate table based on document_type
    IF NEW.document_type = 'kb_article' THEN
        IF NOT EXISTS (SELECT 1 FROM public.kb_articles WHERE id = NEW.reference_id AND NOT deleted) THEN
            RAISE EXCEPTION 'Referenced kb_article does not exist or is deleted';
        END IF;
    ELSIF NEW.document_type = 'ticket' THEN
        IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE id = NEW.reference_id AND NOT deleted) THEN
            RAISE EXCEPTION 'Referenced ticket does not exist or is deleted';
        END IF;
    ELSIF NEW.document_type = 'team' THEN
        IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = NEW.reference_id AND NOT deleted) THEN
            RAISE EXCEPTION 'Referenced team does not exist or is deleted';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for updating timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for cascading deletes if it doesn't exist
CREATE OR REPLACE FUNCTION handle_ai_document_reference_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.ai_documents
    WHERE reference_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers to ensure clean state
DROP TRIGGER IF EXISTS trigger_validate_ai_document ON public.ai_documents;
DROP TRIGGER IF EXISTS update_ai_documents_updated_at ON public.ai_documents;
DROP TRIGGER IF EXISTS trigger_kb_article_delete ON public.kb_articles;
DROP TRIGGER IF EXISTS trigger_ticket_delete ON public.tickets;
DROP TRIGGER IF EXISTS trigger_team_delete ON public.teams;

-- Create triggers
CREATE TRIGGER trigger_validate_ai_document
    BEFORE INSERT OR UPDATE ON public.ai_documents
    FOR EACH ROW
    EXECUTE FUNCTION validate_ai_document_reference();

CREATE TRIGGER update_ai_documents_updated_at
    BEFORE UPDATE ON public.ai_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_kb_article_delete
    BEFORE DELETE ON public.kb_articles
    FOR EACH ROW
    EXECUTE FUNCTION handle_ai_document_reference_delete();

CREATE TRIGGER trigger_ticket_delete
    BEFORE DELETE ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION handle_ai_document_reference_delete();

CREATE TRIGGER trigger_team_delete
    BEFORE DELETE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION handle_ai_document_reference_delete();

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_ai_documents_embedding 
ON ai_documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_ai_documents_document_type 
ON ai_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_ai_documents_reference_id 
ON ai_documents(reference_id);

-- Enable RLS
ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON public.ai_documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON public.ai_documents;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON public.ai_documents;
DROP POLICY IF EXISTS "Service role can manage AI documents" ON public.ai_documents;

-- Create policies
CREATE POLICY "Allow authenticated users to read documents"
ON ai_documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert documents"
ON ai_documents FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update documents"
ON ai_documents FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage AI documents"
ON ai_documents FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS match_documents;

-- Create function for similarity search
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_count int,
    filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    embedding vector(1536),
    similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_variable
BEGIN
    RETURN QUERY
    SELECT
        ai_documents.id,
        ai_documents.content,
        ai_documents.metadata,
        ai_documents.embedding,
        1 - (ai_documents.embedding <=> query_embedding) as similarity
    FROM ai_documents
    WHERE CASE
        WHEN filter->>'document_type' IS NOT NULL THEN
            document_type = (filter->>'document_type')::document_type
        ELSE
            TRUE
        END
    ORDER BY ai_documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant permissions
GRANT ALL ON public.ai_documents TO authenticated;
GRANT ALL ON public.ai_documents TO service_role;
GRANT EXECUTE ON FUNCTION match_documents(vector(1536), int, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents(vector(1536), int, jsonb) TO service_role;

-- Add helpful comments
COMMENT ON TABLE public.ai_documents IS 'Stores AI-related documents with vector embeddings for similarity search';
COMMENT ON CONSTRAINT ai_documents_reference_id_document_type_key ON public.ai_documents 
IS 'Ensures each document can only be referenced once per document type, required for ON CONFLICT support'; 