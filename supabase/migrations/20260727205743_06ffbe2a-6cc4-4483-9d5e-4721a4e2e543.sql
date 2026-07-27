GRANT SELECT ON public.job_postings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.job_postings TO authenticated;
GRANT ALL ON public.job_postings TO service_role;

GRANT SELECT ON public.saved_jobs TO anon, authenticated;
GRANT INSERT, DELETE ON public.saved_jobs TO authenticated;
GRANT ALL ON public.saved_jobs TO service_role;

GRANT SELECT ON public.job_applications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;