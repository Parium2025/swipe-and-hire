-- Add contact email field to job postings
ALTER TABLE public.job_postings 
ADD COLUMN contact_email TEXT;

-- Add application instructions field
ALTER TABLE public.job_postings 
ADD COLUMN application_instructions TEXT;