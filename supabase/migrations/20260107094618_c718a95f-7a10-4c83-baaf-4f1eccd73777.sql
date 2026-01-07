-- Add background location preference to profiles
ALTER TABLE public.profiles
ADD COLUMN background_location_enabled boolean DEFAULT false;