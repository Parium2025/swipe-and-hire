-- Add missing address column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Add missing category column to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Add missing columns to job_applications for complete application data
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS cv_url TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS custom_answers JSONB;