-- Add video_url column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add cv_url column to profiles table if it doesn't exist  
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cv_url TEXT;