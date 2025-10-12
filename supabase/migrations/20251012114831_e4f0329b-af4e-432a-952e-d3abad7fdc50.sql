-- Add missing columns to job_templates table
ALTER TABLE public.job_templates 
ADD COLUMN IF NOT EXISTS occupation text,
ADD COLUMN IF NOT EXISTS salary_type text,
ADD COLUMN IF NOT EXISTS work_location_type text,
ADD COLUMN IF NOT EXISTS remote_work_possible text,
ADD COLUMN IF NOT EXISTS workplace_name text,
ADD COLUMN IF NOT EXISTS workplace_address text,
ADD COLUMN IF NOT EXISTS workplace_postal_code text,
ADD COLUMN IF NOT EXISTS workplace_city text,
ADD COLUMN IF NOT EXISTS positions_count text,
ADD COLUMN IF NOT EXISTS pitch text;