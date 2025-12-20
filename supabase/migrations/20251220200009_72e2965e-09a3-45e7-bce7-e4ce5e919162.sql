-- Add work_schedule column to job_applications for storing how much the applicant currently works
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS work_schedule text;