-- Fix security warnings by removing problematic security definer views
-- and improving the overall security posture

-- Drop any security definer views that may exist
DROP VIEW IF EXISTS public.employer_profile_view;

-- Instead of views, create a secure function to get limited profile data for employers
CREATE OR REPLACE FUNCTION public.get_limited_profile_for_employer(job_seeker_uuid uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role user_role,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  onboarding_completed boolean,
  interests jsonb,
  cv_url text,
  employment_status text,
  working_hours text,
  availability text,
  home_location text,
  first_name text,
  last_name text,
  bio text,
  profile_image_url text,
  video_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the requesting user has permission to view this profile
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('employer', 'recruiter', 'company_admin')
    AND ur.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM profile_view_permissions pvp
    WHERE pvp.job_seeker_id = job_seeker_uuid
    AND pvp.employer_id = auth.uid()
    AND pvp.is_active = true
    AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Access denied: no permission to view this profile';
  END IF;
  
  -- Return limited profile data (excluding sensitive information)
  RETURN QUERY 
  SELECT 
    p.id,
    p.user_id,
    p.role,
    p.created_at,
    p.updated_at,
    p.onboarding_completed,
    p.interests,
    p.cv_url,
    p.employment_status,
    p.working_hours,
    p.availability,
    p.home_location,
    p.first_name,
    p.last_name,
    p.bio,
    p.profile_image_url,
    p.video_url
  FROM profiles p
  WHERE p.user_id = job_seeker_uuid 
    AND p.role = 'job_seeker';
END;
$$;

-- Add trigger to validate profile updates using our security functions
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate for job seeker profiles
  IF NEW.role = 'job_seeker' THEN
    -- Validate the profile data
    IF NOT public.validate_profile_data(NEW.birth_date, NEW.phone, NEW.cv_url) THEN
      RAISE EXCEPTION 'Invalid profile data provided';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger for profile validation
DROP TRIGGER IF EXISTS validate_profile_update_trigger ON public.profiles;
CREATE TRIGGER validate_profile_update_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_update();