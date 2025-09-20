-- Add new columns for employer profiles
ALTER TABLE public.profiles 
ADD COLUMN industry text,
ADD COLUMN address text,
ADD COLUMN website text,
ADD COLUMN company_logo_url text,
ADD COLUMN company_description text,
ADD COLUMN employee_count text;