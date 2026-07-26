REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.daily_hr_news FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.daily_career_tips FROM anon, authenticated;
GRANT SELECT ON public.daily_hr_news TO anon, authenticated;
GRANT SELECT ON public.daily_career_tips TO anon, authenticated;
GRANT ALL ON public.daily_hr_news TO service_role;
GRANT ALL ON public.daily_career_tips TO service_role;