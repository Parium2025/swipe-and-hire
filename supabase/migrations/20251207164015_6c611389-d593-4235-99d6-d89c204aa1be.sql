-- Add work hours columns to job_postings table
ALTER TABLE public.job_postings 
ADD COLUMN work_start_time text,
ADD COLUMN work_end_time text;