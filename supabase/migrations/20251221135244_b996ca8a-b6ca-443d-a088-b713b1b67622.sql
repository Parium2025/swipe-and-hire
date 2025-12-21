-- Helper function to check if two users belong to the same organization
CREATE OR REPLACE FUNCTION public.same_organization(p_user_id_1 uuid, p_user_id_2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur1
    JOIN public.user_roles ur2 ON ur1.organization_id = ur2.organization_id
    WHERE ur1.user_id = p_user_id_1
      AND ur2.user_id = p_user_id_2
      AND ur1.is_active = true
      AND ur2.is_active = true
      AND ur1.organization_id IS NOT NULL
  )
$$;

-- Update get_applicant_profile_media to support organization-based access
CREATE OR REPLACE FUNCTION public.get_applicant_profile_media(p_applicant_id uuid, p_employer_id uuid)
RETURNS TABLE(profile_image_url text, video_url text, is_profile_video boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employer_org_id uuid;
BEGIN
  -- Prevent parameter spoofing: caller must be the employer
  IF auth.uid() IS NULL OR auth.uid() <> p_employer_id THEN
    RETURN;
  END IF;

  -- Get the employer's organization id
  v_employer_org_id := get_user_organization_id(p_employer_id);

  -- Allow access if:
  -- 1. Employer directly owns a job the applicant applied to
  -- 2. Applicant applied to a job owned by someone in the same organization
  -- 3. Has explicit profile view permission
  IF EXISTS (
    SELECT 1
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = p_applicant_id
      AND jp.employer_id = p_employer_id
  ) OR (
    v_employer_org_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.job_applications ja
      JOIN public.job_postings jp ON ja.job_id = jp.id
      JOIN public.user_roles ur ON ur.user_id = jp.employer_id
      WHERE ja.applicant_id = p_applicant_id
        AND ur.organization_id = v_employer_org_id
        AND ur.is_active = true
    )
  ) OR EXISTS (
    SELECT 1
    FROM public.profile_view_permissions pvp
    WHERE pvp.profile_id = p_applicant_id
      AND pvp.viewer_id = p_employer_id
      AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  ) THEN
    RETURN QUERY
    SELECT p.profile_image_url, p.video_url, p.is_profile_video
    FROM public.profiles p
    WHERE p.user_id = p_applicant_id;
  ELSE
    RETURN;
  END IF;
END;
$function$;

-- Update get_applicant_profile_image to support organization-based access
CREATE OR REPLACE FUNCTION public.get_applicant_profile_image(p_applicant_id uuid, p_employer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_image_url text;
  v_employer_org_id uuid;
BEGIN
  -- Prevent parameter spoofing: caller must be the employer
  IF auth.uid() IS NULL OR auth.uid() <> p_employer_id THEN
    RETURN NULL;
  END IF;

  -- Get the employer's organization id
  v_employer_org_id := get_user_organization_id(p_employer_id);

  IF EXISTS (
    SELECT 1
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = p_applicant_id
      AND jp.employer_id = p_employer_id
  ) OR (
    v_employer_org_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.job_applications ja
      JOIN public.job_postings jp ON ja.job_id = jp.id
      JOIN public.user_roles ur ON ur.user_id = jp.employer_id
      WHERE ja.applicant_id = p_applicant_id
        AND ur.organization_id = v_employer_org_id
        AND ur.is_active = true
    )
  ) OR EXISTS (
    SELECT 1
    FROM public.profile_view_permissions pvp
    WHERE pvp.profile_id = p_applicant_id
      AND pvp.viewer_id = p_employer_id
      AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  ) THEN
    SELECT p.profile_image_url
      INTO v_profile_image_url
    FROM public.profiles
    WHERE user_id = p_applicant_id;

    RETURN v_profile_image_url;
  END IF;

  RETURN NULL;
END;
$function$;

-- Update get_consented_profile_for_employer to support organization-based access
CREATE OR REPLACE FUNCTION public.get_consented_profile_for_employer(p_employer_id uuid, p_profile_id uuid)
RETURNS TABLE(id uuid, user_id uuid, first_name text, last_name text, email text, phone text, profile_image_url text, video_url text, cv_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employer_org_id uuid;
BEGIN
  -- Prevent parameter spoofing: caller must be the employer
  IF auth.uid() IS NULL OR auth.uid() <> p_employer_id THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT WHERE FALSE;
    RETURN;
  END IF;

  -- Get the employer's organization id
  v_employer_org_id := get_user_organization_id(p_employer_id);

  -- Check if employer has permission to view this profile
  -- Either through direct job application, organization membership, or explicit permission
  IF EXISTS (
    SELECT 1 FROM public.job_applications ja
    WHERE ja.applicant_id = p_profile_id
      AND ja.job_id IN (
        SELECT id FROM public.job_postings WHERE employer_id = p_employer_id
      )
  ) OR (
    v_employer_org_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.job_applications ja
      JOIN public.job_postings jp ON ja.job_id = jp.id
      JOIN public.user_roles ur ON ur.user_id = jp.employer_id
      WHERE ja.applicant_id = p_profile_id
        AND ur.organization_id = v_employer_org_id
        AND ur.is_active = true
    )
  ) OR EXISTS (
    SELECT 1 FROM public.profile_view_permissions pvp
    WHERE pvp.profile_id = p_profile_id
      AND pvp.viewer_id = p_employer_id
      AND (pvp.expires_at IS NULL OR pvp.expires_at > NOW())
  ) THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.user_id,
      p.first_name,
      p.last_name,
      p.email,
      p.phone,
      p.profile_image_url,
      p.video_url,
      p.cv_url
    FROM public.profiles p
    WHERE p.user_id = p_profile_id;
  ELSE
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT WHERE FALSE;
  END IF;
END;
$function$;

-- Update has_applied_to_employer to support organization-based access
CREATE OR REPLACE FUNCTION public.has_applied_to_employer(p_applicant_id uuid, p_employer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = p_applicant_id
    AND (
      jp.employer_id = p_employer_id
      OR EXISTS (
        SELECT 1
        FROM user_roles ur1
        JOIN user_roles ur2 ON ur1.organization_id = ur2.organization_id
        WHERE ur1.user_id = jp.employer_id
          AND ur2.user_id = p_employer_id
          AND ur1.is_active = true
          AND ur2.is_active = true
          AND ur1.organization_id IS NOT NULL
      )
    )
  )
$function$;