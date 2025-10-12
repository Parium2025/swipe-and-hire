-- Add missing fields to persist full job wizard data
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS salary_type TEXT,
  ADD COLUMN IF NOT EXISTS positions_count INTEGER,
  ADD COLUMN IF NOT EXISTS work_location_type TEXT,
  ADD COLUMN IF NOT EXISTS remote_work_possible TEXT,
  ADD COLUMN IF NOT EXISTS pitch TEXT,
  ADD COLUMN IF NOT EXISTS job_image_url TEXT;