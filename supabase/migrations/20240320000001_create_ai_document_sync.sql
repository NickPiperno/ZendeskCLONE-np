-- Create triggers to keep AI documents in sync with source tables
CREATE OR REPLACE FUNCTION sync_kb_article_to_ai_documents()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' OR NEW.deleted = true THEN
        DELETE FROM ai_documents 
        WHERE document_type = 'kb_article' AND reference_id = OLD.id;
    ELSE
        INSERT INTO ai_documents (
            content,
            metadata,
            document_type,
            reference_id,
            title
        ) VALUES (
            NEW.content,
            jsonb_build_object(
                'category_id', NEW.category_id,
                'author_id', NEW.author_id,
                'is_published', NEW.is_published
            ),
            'kb_article',
            NEW.id,
            NEW.title
        )
        ON CONFLICT (reference_id, document_type)
        DO UPDATE SET
            content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            title = EXCLUDED.title,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_ticket_to_ai_documents()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' OR NEW.deleted = true THEN
        DELETE FROM ai_documents 
        WHERE document_type = 'ticket' AND reference_id = OLD.id;
    ELSE
        INSERT INTO ai_documents (
            content,
            metadata,
            document_type,
            reference_id,
            title
        ) VALUES (
            NEW.description,
            jsonb_build_object(
                'status', NEW.status,
                'priority', NEW.priority,
                'user_id', NEW.user_id,
                'assigned_to', NEW.assigned_to,
                'custom_metadata', NEW.metadata
            ),
            'ticket',
            NEW.id,
            NEW.title
        )
        ON CONFLICT (reference_id, document_type)
        DO UPDATE SET
            content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            title = EXCLUDED.title,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_team_to_ai_documents()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' OR NEW.deleted = true THEN
        DELETE FROM ai_documents 
        WHERE document_type = 'team' AND reference_id = OLD.id;
    ELSE
        -- Aggregate team skills
        WITH team_skills AS (
            SELECT 
                string_agg(s.name, ', ') as skills,
                string_agg(us.proficiency_level::text, ', ') as levels
            FROM team_members tm
            JOIN user_skills us ON us.user_id = tm.user_id
            JOIN skills s ON s.id = us.skill_id
            WHERE tm.team_id = NEW.id
        )
        INSERT INTO ai_documents (
            content,
            metadata,
            document_type,
            reference_id,
            title
        ) 
        SELECT
            NEW.description,
            jsonb_build_object(
                'name', NEW.name,
                'skills', skills,
                'skill_levels', levels,
                'is_active', NEW.is_active
            ),
            'team',
            NEW.id,
            NEW.name
        FROM team_skills
        ON CONFLICT (reference_id, document_type)
        DO UPDATE SET
            content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            title = EXCLUDED.title,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_kb_article_ai ON public.kb_articles;
DROP TRIGGER IF EXISTS sync_ticket_ai ON public.tickets;
DROP TRIGGER IF EXISTS sync_team_ai ON public.teams;

-- Create triggers for each source table
CREATE TRIGGER sync_kb_article_ai
    AFTER INSERT OR UPDATE OR DELETE ON kb_articles
    FOR EACH ROW
    EXECUTE FUNCTION sync_kb_article_to_ai_documents();

CREATE TRIGGER sync_ticket_ai
    AFTER INSERT OR UPDATE OR DELETE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION sync_ticket_to_ai_documents();

CREATE TRIGGER sync_team_ai
    AFTER INSERT OR UPDATE OR DELETE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION sync_team_to_ai_documents();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sync_kb_article_to_ai_documents() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_ticket_to_ai_documents() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_team_to_ai_documents() TO authenticated; 