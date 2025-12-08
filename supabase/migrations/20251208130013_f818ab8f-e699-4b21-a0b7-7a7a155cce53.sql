-- Add column for storing original (uncropped) company logo URL
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_logo_original_url TEXT;