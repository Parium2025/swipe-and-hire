-- Add indexes to job_applications for faster candidate queries
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id_applied_at 
ON public.job_applications (job_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_applications_applied_at_desc 
ON public.job_applications (applied_at DESC);