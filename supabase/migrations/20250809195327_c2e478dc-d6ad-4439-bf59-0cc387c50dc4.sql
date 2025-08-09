-- Add onboarding completion tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;