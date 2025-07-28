-- Add category column to job_postings table for automatic categorization
ALTER TABLE public.job_postings 
ADD COLUMN category TEXT;