-- Add company_social_media_links column to profiles table
-- This separates company social media from individual profile social media
ALTER TABLE public.profiles
ADD COLUMN company_social_media_links jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.company_social_media_links IS 'Social media links for the company (used in CompanyProfile)';
COMMENT ON COLUMN public.profiles.social_media_links IS 'Social media links for the individual user (used in EmployerProfile)';