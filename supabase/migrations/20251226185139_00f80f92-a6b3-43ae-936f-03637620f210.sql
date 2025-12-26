-- Add viewed_at column to job_applications to track when employer first viewed an application
ALTER TABLE public.job_applications
ADD COLUMN viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for faster queries on unread applications
CREATE INDEX idx_job_applications_viewed_at ON public.job_applications(viewed_at) WHERE viewed_at IS NULL;