-- Add unique constraint to prevent duplicate job applications
-- (same person can't apply twice to the same job)
-- Drop the existing non-unique index first, then create a unique one
DROP INDEX IF EXISTS idx_job_applications_job_applicant;
CREATE UNIQUE INDEX idx_job_applications_job_applicant ON public.job_applications (job_id, applicant_id);