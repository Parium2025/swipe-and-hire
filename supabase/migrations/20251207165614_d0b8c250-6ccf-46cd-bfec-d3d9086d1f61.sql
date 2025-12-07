-- Add benefits column to job_postings table (array of text for multiple selections)
ALTER TABLE public.job_postings 
ADD COLUMN benefits text[];