ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.job_templates ADD COLUMN IF NOT EXISTS start_date date;