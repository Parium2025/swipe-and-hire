-- Security Enhancement: Implement Data Masking and Stricter Access Controls for Profile Data

-- 1. Drop existing function to recreate with enhanced security
DROP FUNCTION IF EXISTS public.get_limited_profile_for_employer(uuid);

-- 2. Create enhanced audit logging function for profile access
CREATE OR REPLACE FUNCTION public.log_profile_access_attempt(
  job_seeker_uuid uuid, 
  employer_uuid uuid, 
  access_granted boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) VALUES (
    employer_uuid,
    CASE WHEN access_granted THEN 'profile_access_granted' ELSE 'profile_access_denied' END,
    'profiles',
    job_seeker_uuid,
    jsonb_build_object(
      'job_seeker_id', job_seeker_uuid,
      'employer_id', employer_uuid,
      'timestamp', now(),
      'access_granted', access_granted
    )
  );
END;
$$;

-- 3. Create secure masked profile function with strict access controls
CREATE OR REPLACE FUNCTION public.get_masked_profile_for_employer(job_seeker_uuid uuid)
RETURNS TABLE(
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
  -- Sensitive fields are masked or excluded
  bio text, 
  profile_image_url text, 
  video_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  employer_role text;
  permission_valid boolean := false;
  permission_expires_at timestamp with time zone;
BEGIN
  -- Get employer role
  SELECT get_user_role(auth.uid()) INTO employer_role;
  
  -- Check if user has employer permissions
  IF employer_role NOT IN ('employer', 'recruiter', 'company_admin') THEN
    -- Log unauthorized access attempt
    PERFORM log_profile_access_attempt(job_seeker_uuid, auth.uid(), false);
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;
  
  -- Check if permission exists and is valid
  SELECT 
    CASE 
      WHEN pvp.expires_at IS NULL THEN true
      WHEN pvp.expires_at > now() THEN true
      ELSE false
    END,
    pvp.expires_at
  INTO permission_valid, permission_expires_at
  FROM profile_view_permissions pvp
  WHERE pvp.job_seeker_id = job_seeker_uuid
    AND pvp.employer_id = auth.uid()
    AND pvp.is_active = true;
  
  -- If no valid permission found, deny access
  IF NOT permission_valid OR permission_valid IS NULL THEN
    -- Log access denial
    PERFORM log_profile_access_attempt(job_seeker_uuid, auth.uid(), false);
    RAISE EXCEPTION 'Access denied: no valid permission to view this profile';
  END IF;
  
  -- Log successful access
  PERFORM log_profile_access_attempt(job_seeker_uuid, auth.uid(), true);
  
  -- Return masked profile data (excluding sensitive fields)
  RETURN QUERY 
  SELECT 
    p.id,
    p.user_id,
    p.role,
    p.created_at,
    p.updated_at,
    p.onboarding_completed,
    p.interests,
    p.cv_url, -- CV is business relevant
    p.employment_status,
    p.working_hours,
    p.availability,
    -- Mask location to city level only (remove street details)
    CASE 
      WHEN p.home_location IS NOT NULL THEN 
        split_part(p.home_location, ',', 1) -- Only return city part
      ELSE NULL
    END as home_location,
    p.first_name,
    -- Truncate bio to first 200 characters for privacy
    CASE 
      WHEN length(p.bio) > 200 THEN left(p.bio, 200) || '...'
      ELSE p.bio
    END as bio,
    p.profile_image_url,
    p.video_url
  FROM profiles p
  WHERE p.user_id = job_seeker_uuid 
    AND p.role = 'job_seeker';
    
  -- Note: Sensitive fields NOT returned:
  -- - phone (completely excluded)
  -- - birth_date (completely excluded) 
  -- - last_name (completely excluded)
  -- - detailed location (masked to city only)
  -- - full bio (truncated for privacy)
END;
$$;

-- 4. Update profile view permissions to have shorter expiration times
CREATE OR REPLACE FUNCTION public.grant_limited_profile_access_on_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Grant limited profile access to employer when someone applies to their job
  INSERT INTO public.profile_view_permissions (
    job_seeker_id, 
    employer_id, 
    job_posting_id,
    permission_type,
    expires_at
  )
  SELECT 
    NEW.applicant_id,
    jp.employer_id,
    NEW.job_id,
    'application_based',
    now() + interval '30 days' -- Reduced from 90 to 30 days for better security
  FROM public.job_postings jp
  WHERE jp.id = NEW.job_id
  ON CONFLICT (job_seeker_id, employer_id, job_posting_id) 
  DO UPDATE SET 
    is_active = true,
    expires_at = now() + interval '30 days'; -- Reduced expiration time
  
  RETURN NEW;
END;
$$;

-- 5. Create function to revoke profile access permissions
CREATE OR REPLACE FUNCTION public.revoke_profile_access(
  target_employer_id uuid,
  job_seeker_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  -- Only allow job seekers to revoke access to their own profiles
  -- or super admins to revoke any access
  IF NOT (
    (job_seeker_id IS NULL AND current_user_id = auth.uid()) OR 
    (job_seeker_id = current_user_id) OR 
    is_super_admin(current_user_id)
  ) THEN
    RETURN false;
  END IF;
  
  -- If job_seeker_id is null, use current user
  IF job_seeker_id IS NULL THEN
    job_seeker_id := current_user_id;
  END IF;
  
  -- Revoke access by setting is_active to false
  UPDATE public.profile_view_permissions 
  SET is_active = false, updated_at = now()
  WHERE employer_id = target_employer_id 
    AND job_seeker_id = revoke_profile_access.job_seeker_id;
  
  -- Log the revocation
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    record_id
  ) VALUES (
    current_user_id,
    'profile_access_revoked',
    'profile_view_permissions',
    target_employer_id
  );
  
  RETURN true;
END;
$$;

-- 6. Update the existing RLS policy to be more restrictive
DROP POLICY IF EXISTS "Employers can view job seeker profiles with verified permission" ON public.profiles;

-- Create new restrictive policy that only allows access through the secure function
CREATE POLICY "Employers can only access profiles through secure function" 
ON public.profiles 
FOR SELECT 
USING (
  -- Only allow direct access to own profile or super admin access
  (auth.uid() = user_id) OR 
  is_super_admin(auth.uid())
);

-- 7. Create a cleanup function for expired permissions
CREATE OR REPLACE FUNCTION public.cleanup_expired_profile_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Deactivate expired permissions
  UPDATE public.profile_view_permissions 
  SET is_active = false
  WHERE expires_at < now() AND is_active = true;
  
  -- Log cleanup action
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, -- System user
    'expired_permissions_cleanup',
    'profile_view_permissions'
  );
END;
$$;