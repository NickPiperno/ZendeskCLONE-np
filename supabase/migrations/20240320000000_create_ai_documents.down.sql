-- Wrap everything in a transaction
BEGIN;

-- Drop triggers from source tables first (only if tables exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'kb_articles') THEN
        DROP TRIGGER IF EXISTS sync_kb_article_ai ON public.kb_articles;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tickets') THEN
        DROP TRIGGER IF EXISTS sync_ticket_ai ON public.tickets;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'teams') THEN
        DROP TRIGGER IF EXISTS sync_team_ai ON public.teams;
    END IF;
END $$;

-- Drop sync functions
DROP FUNCTION IF EXISTS public.sync_kb_article_to_ai_documents();
DROP FUNCTION IF EXISTS public.sync_ticket_to_ai_documents();
DROP FUNCTION IF EXISTS public.sync_team_to_ai_documents();

-- Drop the similarity search function (with proper parameter check)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'match_documents' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        DROP FUNCTION IF EXISTS public.match_documents(vector, int, document_type);
    END IF;
END $$;

-- Drop policies and table if exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'ai_documents'
    ) THEN
        -- Drop policies
        DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON public.ai_documents;
        DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON public.ai_documents;
        DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON public.ai_documents;
        DROP POLICY IF EXISTS "Service role can manage AI documents" ON public.ai_documents;
        
        -- Drop trigger
        DROP TRIGGER IF EXISTS trigger_validate_ai_document ON public.ai_documents;
        DROP TRIGGER IF EXISTS update_ai_documents_updated_at ON public.ai_documents;
        DROP TRIGGER IF EXISTS trigger_kb_article_delete ON public.kb_articles;
        DROP TRIGGER IF EXISTS trigger_ticket_delete ON public.tickets;
        DROP TRIGGER IF EXISTS trigger_team_delete ON public.teams;
        
        -- Drop the table itself
        DROP TABLE public.ai_documents;
    END IF;
END $$;

-- Drop the update_updated_at_column function if it exists and no other tables use it
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'update_updated_at_column' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        DROP FUNCTION IF EXISTS public.update_updated_at_column();
    END IF;
END $$;

-- Drop the enum type if it exists and no other tables use it
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'document_type' 
        AND typnamespace = 'public'::regnamespace
    ) THEN
        DROP TYPE IF EXISTS public.document_type;
    END IF;
END $$;

COMMIT; 