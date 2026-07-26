GRANT SELECT ON public.daily_hr_news TO anon, authenticated;
GRANT ALL ON public.daily_hr_news TO service_role;
GRANT SELECT ON public.daily_career_tips TO anon, authenticated;
GRANT ALL ON public.daily_career_tips TO service_role;
GRANT ALL ON public.rss_source_health TO service_role;