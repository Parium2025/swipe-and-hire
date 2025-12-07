-- Add salary transparency column to job_postings (EU directive 2023/970, deadline June 2026)
ALTER TABLE public.job_postings 
ADD COLUMN salary_transparency TEXT;