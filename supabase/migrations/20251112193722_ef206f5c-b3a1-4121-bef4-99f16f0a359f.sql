-- Migration: Convert all media URLs to permanent storage paths
-- This ensures videos, images, and CVs never expire and always remain accessible

-- Function to extract storage path from URL
CREATE OR REPLACE FUNCTION public.extract_storage_path(url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  path_part text;
BEGIN
  IF url IS NULL OR url = '' THEN
    RETURN NULL;
  END IF;
  
  -- Already a storage path (no http)
  IF url NOT LIKE 'http%' THEN
    RETURN url;
  END IF;
  
  -- Extract from public URL format
  IF url LIKE '%/storage/v1/object/public/%' THEN
    path_part := substring(url from '/storage/v1/object/public/[^/]+/(.+)');
    IF path_part IS NOT NULL THEN
      -- Remove query parameters
      RETURN split_part(path_part, '?', 1);
    END IF;
  END IF;
  
  -- Extract from signed URL format
  IF url LIKE '%/storage/v1/object/sign/%' THEN
    path_part := substring(url from '/storage/v1/object/sign/[^/]+/(.+)');
    IF path_part IS NOT NULL THEN
      -- Remove query parameters and tokens
      RETURN split_part(path_part, '?', 1);
    END IF;
  END IF;
  
  -- Couldn't extract path, return original
  RETURN url;
END;
$$;

-- Update profiles table: convert URLs to storage paths
UPDATE public.profiles
SET 
  video_url = public.extract_storage_path(video_url),
  profile_image_url = public.extract_storage_path(profile_image_url),
  cover_image_url = public.extract_storage_path(cover_image_url),
  cv_url = public.extract_storage_path(cv_url)
WHERE 
  video_url LIKE 'http%' OR 
  profile_image_url LIKE 'http%' OR 
  cover_image_url LIKE 'http%' OR 
  cv_url LIKE 'http%';

-- Update job_applications table: convert CV URLs to storage paths
UPDATE public.job_applications
SET 
  cv_url = public.extract_storage_path(cv_url)
WHERE 
  cv_url LIKE 'http%';

-- Update validation function to accept both old URLs and new paths during transition
CREATE OR REPLACE FUNCTION public.validate_profile_data(birth_date date, phone text, cv_url text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN  
  -- Validate birth date (must be at least 16 years old)
  IF birth_date IS NOT NULL AND birth_date > (CURRENT_DATE - INTERVAL '16 years') THEN
    RETURN false;
  END IF;
  
  -- Validate phone number format (Swedish format)
  IF phone IS NOT NULL AND phone !~ '^(\+46|0)[1-9][0-9]{7,9}$' THEN
    RETURN false;
  END IF;
  
  -- Validate CV URL - accept storage paths (preferred) or full URLs
  IF cv_url IS NOT NULL AND cv_url != '' THEN
    -- Accept storage path format (uuid/timestamp-random.ext)
    IF cv_url ~ '^[a-f0-9\-]{36}/[0-9]{13}-[a-z0-9]+\.[a-zA-Z0-9]+$' THEN
      RETURN true;
    END IF;
    
    -- Accept Supabase storage URLs (for backward compatibility during transition)
    IF cv_url LIKE '%/job-applications/%' OR cv_url LIKE '%/profile-media/%' THEN
      RETURN true;
    END IF;
    
    -- Reject other formats
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.extract_storage_path IS 'Extracts permanent storage path from Supabase URLs (public/signed) for long-term accessibility';
