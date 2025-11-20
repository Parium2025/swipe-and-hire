-- Add missing columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_count TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add job_image_url column to job_postings if missing
ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS job_image_url TEXT;

-- Update job_postings foreign key to reference profiles instead of auth.users
-- First, drop the old constraint
ALTER TABLE public.job_postings DROP CONSTRAINT IF EXISTS job_postings_employer_id_fkey;

-- Add new foreign key to profiles
ALTER TABLE public.job_postings ADD CONSTRAINT job_postings_employer_id_fkey 
  FOREIGN KEY (employer_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;