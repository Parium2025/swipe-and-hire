-- Add soft delete column to job_postings
ALTER TABLE public.job_postings 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient filtering of non-deleted jobs
CREATE INDEX idx_job_postings_deleted_at ON public.job_postings(deleted_at) WHERE deleted_at IS NULL;

-- Update RLS policy for employers to hide deleted jobs from active listings
-- but keep them visible for historical purposes
DROP POLICY IF EXISTS "Employers can view their own jobs" ON public.job_postings;

CREATE POLICY "Employers can view their own jobs" 
ON public.job_postings 
FOR SELECT 
USING (employer_id = auth.uid());

-- Job seekers should still be able to see deleted jobs if they applied
-- (the job_applications RLS already handles this via job_id reference)