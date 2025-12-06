-- Add foreign key relationship between job_applications and job_postings
ALTER TABLE public.job_applications
ADD CONSTRAINT job_applications_job_id_fkey
FOREIGN KEY (job_id) REFERENCES public.job_postings(id) ON DELETE CASCADE;