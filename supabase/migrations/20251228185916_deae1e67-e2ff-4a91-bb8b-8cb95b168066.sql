-- Add last_active_at column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN last_active_at timestamp with time zone DEFAULT now();

-- Update existing profiles to have a reasonable default (created_at)
UPDATE public.profiles 
SET last_active_at = COALESCE(updated_at, created_at);

-- Create an index for efficient querying
CREATE INDEX idx_profiles_last_active_at ON public.profiles(last_active_at DESC);