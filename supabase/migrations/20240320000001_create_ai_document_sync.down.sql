-- Drop triggers
DROP TRIGGER IF EXISTS sync_kb_article_ai ON public.kb_articles;
DROP TRIGGER IF EXISTS sync_ticket_ai ON public.tickets;
DROP TRIGGER IF EXISTS sync_team_ai ON public.teams;

-- Drop functions
DROP FUNCTION IF EXISTS sync_kb_article_to_ai_documents();
DROP FUNCTION IF EXISTS sync_ticket_to_ai_documents();
DROP FUNCTION IF EXISTS sync_team_to_ai_documents(); 