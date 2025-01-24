-- Create knowledge base categories table
CREATE TABLE IF NOT EXISTS public.kb_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ
);

-- Create knowledge base articles table with full-text search
CREATE TABLE IF NOT EXISTS public.kb_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category_id UUID REFERENCES public.kb_categories(id),
    author_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_published BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ,
    last_reviewed_by UUID REFERENCES auth.users(id),
    deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED
);

-- Create article tags table
CREATE TABLE IF NOT EXISTS public.kb_article_tags (
    article_id UUID REFERENCES public.kb_articles(id),
    tag TEXT NOT NULL,
    PRIMARY KEY (article_id, tag)
);

-- Create article feedback table
CREATE TABLE IF NOT EXISTS public.kb_article_feedback (
    article_id UUID REFERENCES public.kb_articles(id),
    user_id UUID REFERENCES auth.users(id),
    is_helpful BOOLEAN NOT NULL,
    comment TEXT,
    UNIQUE(article_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_article_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_article_feedback ENABLE ROW LEVEL SECURITY;

-- Categories Policies
DROP POLICY IF EXISTS "Everyone can view active categories" ON public.kb_categories;
CREATE POLICY "Everyone can view active categories"
    ON public.kb_categories FOR SELECT
    USING (is_active AND NOT deleted);

DROP POLICY IF EXISTS "Only admins can manage categories" ON public.kb_categories;
CREATE POLICY "Only admins can manage categories"
    ON public.kb_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Articles Policies
DROP POLICY IF EXISTS "Everyone can view published articles" ON public.kb_articles;
CREATE POLICY "Everyone can view published articles"
    ON public.kb_articles FOR SELECT
    USING (is_published AND NOT deleted);

DROP POLICY IF EXISTS "Admins can view all articles" ON public.kb_articles;
CREATE POLICY "Admins can view all articles"
    ON public.kb_articles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins and agents can create articles" ON public.kb_articles;
CREATE POLICY "Admins and agents can create articles"
    ON public.kb_articles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'agent')
        )
    );

DROP POLICY IF EXISTS "Admins and article authors can update articles" ON public.kb_articles;
CREATE POLICY "Admins and article authors can update articles"
    ON public.kb_articles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR (role = 'agent' AND author_id = auth.uid()))
        )
    );

-- Tags Policies
DROP POLICY IF EXISTS "Everyone can view article tags" ON public.kb_article_tags;
CREATE POLICY "Everyone can view article tags"
    ON public.kb_article_tags FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins and article owners can manage tags" ON public.kb_article_tags;
CREATE POLICY "Admins and article owners can manage tags"
    ON public.kb_article_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.kb_articles a
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE a.id = kb_article_tags.article_id
            AND (p.role = 'admin' OR (p.role = 'agent' AND a.author_id = auth.uid()))
        )
    );

-- Feedback Policies
DROP POLICY IF EXISTS "Everyone can view article feedback" ON public.kb_article_feedback;
CREATE POLICY "Everyone can view article feedback"
    ON public.kb_article_feedback FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit feedback" ON public.kb_article_feedback;
CREATE POLICY "Authenticated users can submit feedback"
    ON public.kb_article_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own feedback" ON public.kb_article_feedback;
CREATE POLICY "Users can update their own feedback"
    ON public.kb_article_feedback FOR UPDATE
    USING (auth.uid() = user_id);

-- Create indexes for performance
DROP INDEX IF EXISTS idx_kb_articles_search_vector;
CREATE INDEX IF NOT EXISTS idx_kb_articles_search_vector ON public.kb_articles USING gin(search_vector);

DROP INDEX IF EXISTS idx_kb_articles_category;
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON public.kb_articles(category_id) WHERE NOT deleted;

DROP INDEX IF EXISTS idx_kb_articles_published;
CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON public.kb_articles(created_at DESC) WHERE is_published AND NOT deleted;

-- Create full-text search function
CREATE OR REPLACE FUNCTION public.search_kb_articles(
    search_query TEXT,
    p_category_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content_preview TEXT,
    category_id UUID,
    rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.title,
        ts_headline('english', a.content, websearch_to_tsquery('english', search_query),
            'StartSel = <mark>, StopSel = </mark>, MaxWords=50, MinWords=15'
        ) as content_preview,
        a.category_id,
        ts_rank(a.search_vector, websearch_to_tsquery('english', search_query)) as rank
    FROM public.kb_articles a
    WHERE 
        a.is_published 
        AND NOT a.deleted
        AND (p_category_id IS NULL OR a.category_id = p_category_id)
        AND a.search_vector @@ websearch_to_tsquery('english', search_query)
    ORDER BY rank DESC;
END;
$$;

-- Grant permissions
GRANT ALL ON public.kb_categories TO authenticated;
GRANT ALL ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_article_tags TO authenticated;
GRANT ALL ON public.kb_article_feedback TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_kb_articles TO authenticated;

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_article_feedback_counts_trigger ON kb_article_feedback;
DROP FUNCTION IF EXISTS update_article_feedback_counts();

-- Add trigger function for feedback counts
CREATE OR REPLACE FUNCTION update_article_feedback_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment the appropriate counter
        UPDATE kb_articles
        SET 
            helpful_count = CASE WHEN NEW.is_helpful THEN helpful_count + 1 ELSE helpful_count END,
            not_helpful_count = CASE WHEN NOT NEW.is_helpful THEN not_helpful_count + 1 ELSE not_helpful_count END
        WHERE id = NEW.article_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Decrement old counter and increment new one if the feedback changed
        IF OLD.is_helpful != NEW.is_helpful THEN
            UPDATE kb_articles
            SET 
                helpful_count = CASE 
                    WHEN NEW.is_helpful THEN helpful_count + 1
                    ELSE helpful_count - 1
                END,
                not_helpful_count = CASE 
                    WHEN NOT NEW.is_helpful THEN not_helpful_count + 1
                    ELSE not_helpful_count - 1
                END
            WHERE id = NEW.article_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_article_feedback_counts_trigger
AFTER INSERT OR UPDATE ON kb_article_feedback
FOR EACH ROW
EXECUTE FUNCTION update_article_feedback_counts(); 