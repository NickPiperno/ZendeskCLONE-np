-- Drop existing policies
DROP POLICY IF EXISTS "Users can add skills to their tickets" ON public.ticket_skills;
DROP POLICY IF EXISTS "Admins and agents can manage ticket skills" ON public.ticket_skills;
DROP POLICY IF EXISTS "Everyone can view ticket skills" ON public.ticket_skills;
DROP POLICY IF EXISTS "Only admins can access ticket skills" ON public.ticket_skills;

-- Create new admin-only policy for all operations
CREATE POLICY "Only admins can access ticket skills"
    ON public.ticket_skills FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    ); 