-- Add cover_image_url field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN cover_image_url TEXT;