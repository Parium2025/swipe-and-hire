-- Tighten and correct employer access to applicant profile media
-- Ensures ONLY the logged-in employer who owns a job the applicant applied to can fetch media paths.

CREATE OR REPLACE FUNCTION public.get_applicant_profile_media(p_applicant_id uuid, p_employer_id uuid)
RETURNS TABLE(profile_image_url text, video_url text, is_profile_video boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Prevent parameter spoofing: caller must be the employer
  IF auth.uid() IS NULL OR auth.uid() <> p_employer_id THEN
    RETURN;
  END IF;

  -- Allow access if employer owns a job the applicant applied to OR has explicit permission
  IF EXISTS (
    SELECT 1
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = p_applicant_id
      AND jp.employer_id = p_employer_id
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
$$;

CREATE OR REPLACE FUNCTION public.get_applicant_profile_image(p_applicant_id uuid, p_employer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_image_url text;
BEGIN
  -- Prevent parameter spoofing: caller must be the employer
  IF auth.uid() IS NULL OR auth.uid() <> p_employer_id THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = p_applicant_id
      AND jp.employer_id = p_employer_id
  ) OR EXISTS (
    SELECT 1
    FROM public.profile_view_permissions pvp
    WHERE pvp.profile_id = p_applicant_id
      AND pvp.viewer_id = p_employer_id
      AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  ) THEN
    SELECT profile_image_url
      INTO v_profile_image_url
    FROM public.profiles
    WHERE user_id = p_applicant_id;

    RETURN v_profile_image_url;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_consented_profile_for_employer(p_employer_id uuid, p_profile_id uuid)
RETURNS TABLE(id uuid, user_id uuid, first_name text, last_name text, email text, phone text, profile_image_url text, video_url text, cv_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Prevent parameter spoofing: caller must be the employer
  IF auth.uid() IS NULL OR auth.uid() <> p_employer_id THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT WHERE FALSE;
    RETURN;
  END IF;

  -- Check if employer has permission to view this profile
  -- Either through job application or explicit permission
  IF EXISTS (
    SELECT 1 FROM public.job_applications ja
    WHERE ja.applicant_id = p_profile_id
      AND ja.job_id IN (
        SELECT id FROM public.job_postings WHERE employer_id = p_employer_id
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
$$;

-- Lock down execution to authenticated users only
REVOKE ALL ON FUNCTION public.get_applicant_profile_media(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_applicant_profile_image(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_consented_profile_for_employer(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_applicant_profile_media(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_applicant_profile_image(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consented_profile_for_employer(uuid, uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_applicant_profile_media(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_applicant_profile_image(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_consented_profile_for_employer(uuid, uuid) TO service_role;
