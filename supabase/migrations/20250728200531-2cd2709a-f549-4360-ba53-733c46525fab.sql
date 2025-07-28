-- Add cv_url column to profiles table for CV storage
ALTER TABLE public.profiles 
ADD COLUMN cv_url TEXT;