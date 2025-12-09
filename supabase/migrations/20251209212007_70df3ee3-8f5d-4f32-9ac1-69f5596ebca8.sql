-- Add missing columns to job_postings table for complete job data storage
ALTER TABLE public.job_postings 
ADD COLUMN IF NOT EXISTS salary_type text,
ADD COLUMN IF NOT EXISTS positions_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS work_location_type text,
ADD COLUMN IF NOT EXISTS remote_work_possible text,
ADD COLUMN IF NOT EXISTS workplace_name text,
ADD COLUMN IF NOT EXISTS workplace_address text,
ADD COLUMN IF NOT EXISTS workplace_postal_code text,
ADD COLUMN IF NOT EXISTS workplace_city text,
ADD COLUMN IF NOT EXISTS workplace_county text,
ADD COLUMN IF NOT EXISTS workplace_municipality text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS application_instructions text,
ADD COLUMN IF NOT EXISTS pitch text,
ADD COLUMN IF NOT EXISTS category text;