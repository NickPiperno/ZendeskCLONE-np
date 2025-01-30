-- Grant permissions to service role
GRANT ALL ON public.skills TO service_role;
GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.team_schedules TO service_role;
GRANT ALL ON public.user_skills TO service_role;
GRANT ALL ON public.ticket_skills TO service_role;
GRANT ALL ON public.ticket_tags TO service_role;
GRANT ALL ON public.tags TO service_role;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role; 