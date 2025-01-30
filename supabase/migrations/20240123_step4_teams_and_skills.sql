-- Create skill categories
CREATE TYPE skill_category AS ENUM ('technical', 'product', 'language', 'soft_skill');

-- Create teams table
CREATE TABLE public.teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ
);

-- Create skills table
CREATE TABLE public.skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    category skill_category NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Create team_members table (junction table for teams and users)
CREATE TABLE public.team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    team_id UUID REFERENCES public.teams(id),
    user_id UUID REFERENCES auth.users(id),
    is_team_lead BOOLEAN DEFAULT false,
    UNIQUE(team_id, user_id)
);

-- Create user_skills table (junction table for users and skills)
CREATE TABLE public.user_skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    skill_id UUID REFERENCES public.skills(id),
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
    UNIQUE(user_id, skill_id)
);

-- Create team_schedules table
CREATE TABLE public.team_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    team_id UUID REFERENCES public.teams(id),
    user_id UUID REFERENCES auth.users(id),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_schedules ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Everyone can view active teams"
    ON public.teams FOR SELECT
    USING (NOT deleted);

CREATE POLICY "Only admins can create teams"
    ON public.teams FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update teams"
    ON public.teams FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Skills policies
CREATE POLICY "Everyone can view skills"
    ON public.skills FOR SELECT
    USING (is_active);

CREATE POLICY "Only admins can manage skills"
    ON public.skills FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Team members policies
CREATE POLICY "Everyone can view team members"
    ON public.team_members FOR SELECT
    USING (true);

CREATE POLICY "Only admins can manage team members"
    ON public.team_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- User skills policies
CREATE POLICY "Everyone can view user skills"
    ON public.user_skills FOR SELECT
    USING (true);

CREATE POLICY "Users can manage their own skills"
    ON public.user_skills FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user skills"
    ON public.user_skills FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Team schedules policies
CREATE POLICY "Everyone can view team schedules"
    ON public.team_schedules FOR SELECT
    USING (is_active);

CREATE POLICY "Only admins can manage schedules"
    ON public.team_schedules FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Grant permissions
GRANT ALL ON public.teams TO authenticated;
GRANT ALL ON public.skills TO authenticated;
GRANT ALL ON public.team_members TO authenticated;
GRANT ALL ON public.user_skills TO authenticated;
GRANT ALL ON public.team_schedules TO authenticated;

-- Create soft delete function for teams
CREATE OR REPLACE FUNCTION public.soft_delete_team(team_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.teams
    SET deleted = true,
        deleted_at = NOW()
    WHERE id = team_id
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_team(UUID) TO authenticated;

-- Grant additional permissions to service role for AI functionality
GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.kb_articles TO service_role;
GRANT ALL ON public.tickets TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role; 