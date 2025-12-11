-- Add separate desktop image column for job postings
ALTER TABLE public.job_postings 
ADD COLUMN job_image_desktop_url text;