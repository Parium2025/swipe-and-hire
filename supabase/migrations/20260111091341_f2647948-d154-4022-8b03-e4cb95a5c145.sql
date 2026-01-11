-- Create a generated tsvector column for full-text search on job_applications
-- This enables fast, scalable search across 100k+ candidates

-- Add tsvector column for search
ALTER TABLE public.job_applications 
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(first_name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(last_name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(email, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(phone, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(location, '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(bio, '')), 'D')
) STORED;

-- Create GIN index for fast full-text search (handles millions of rows efficiently)
CREATE INDEX IF NOT EXISTS idx_job_applications_search_vector 
ON public.job_applications USING GIN (search_vector);

-- Also add B-tree indexes for common filtering patterns
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_id ON public.job_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applied_at ON public.job_applications(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);

-- Add index on job_postings for employer lookups (RLS performance)
CREATE INDEX IF NOT EXISTS idx_job_postings_employer_id ON public.job_postings(employer_id);

-- Comment explaining the search vector
COMMENT ON COLUMN public.job_applications.search_vector IS 'Full-text search vector for fast candidate filtering. Weights: A=name, B=contact, C=location, D=bio';