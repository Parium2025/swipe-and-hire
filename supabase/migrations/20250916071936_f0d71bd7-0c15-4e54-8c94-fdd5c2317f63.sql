CREATE OR REPLACE FUNCTION public.get_consented_profile_for_employer(job_seeker_uuid uuid)
 RETURNS TABLE(id uuid, user_id uuid, role user_role, created_at timestamp with time zone, updated_at timestamp with time zone, onboarding_completed boolean, interests jsonb, cv_url text, employment_status text, working_hours text, availability text, home_location text, first_name text, last_name text, age integer, profile_image_url text, video_url text, phone text, postal_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  employer_role text;
  permission_valid boolean := false;
  user_consented boolean := false;
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
    END
  INTO permission_valid
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
  
  -- Check if user has given consent to share their data
  SELECT user_has_given_consent(job_seeker_uuid) INTO user_consented;
  
  IF NOT user_consented THEN
    -- Log consent denial
    PERFORM log_profile_access_attempt(job_seeker_uuid, auth.uid(), false);
    RAISE EXCEPTION 'Access denied: user has not consented to data sharing';
  END IF;
  
  -- Log successful access
  PERFORM log_profile_access_attempt(job_seeker_uuid, auth.uid(), true);
  
  -- Return consented profile data with age instead of birth_date and include last_name
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
    -- Return city/municipality from location
    CASE 
      WHEN p.home_location IS NOT NULL THEN 
        split_part(p.home_location, ',', 1)
      ELSE p.location
    END as home_location,
    p.first_name,
    p.last_name, -- Now including last name with consent
    -- Calculate age from birth_date instead of returning birth_date
    CASE 
      WHEN p.birth_date IS NOT NULL THEN calculate_age(p.birth_date)
      ELSE NULL
    END as age,
    p.profile_image_url,
    p.video_url,
    -- Include phone and postal_code with consent
    p.phone,
    p.postal_code
  FROM profiles p
  WHERE p.user_id = job_seeker_uuid 
    AND p.role = 'job_seeker';
END;
$function$