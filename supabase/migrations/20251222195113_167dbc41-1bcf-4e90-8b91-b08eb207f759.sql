-- Enable realtime for saved_jobs and job_applications tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;