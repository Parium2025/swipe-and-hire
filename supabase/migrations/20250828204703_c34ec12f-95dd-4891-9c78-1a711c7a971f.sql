-- Add cv_filename column to profiles table to store original filename
ALTER TABLE public.profiles 
ADD COLUMN cv_filename text;