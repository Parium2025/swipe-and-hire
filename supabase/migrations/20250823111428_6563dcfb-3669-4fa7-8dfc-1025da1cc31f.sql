-- Add extended profile fields for welcome tunnel data
ALTER TABLE public.profiles 
ADD COLUMN employment_status TEXT,
ADD COLUMN working_hours TEXT,
ADD COLUMN availability TEXT,
ADD COLUMN interests JSONB DEFAULT '[]'::jsonb,
ADD COLUMN home_location TEXT;