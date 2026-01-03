-- Drop and recreate the function to include last_active_at
DROP FUNCTION IF EXISTS get_applicant_profile_media(uuid, uuid);

CREATE OR REPLACE FUNCTION get_applicant_profile_media(p_applicant_id uuid, p_employer_id uuid)
RETURNS TABLE (
  profile_image_url text,
  video_url text,
  is_profile_video boolean,
  last_active_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    SELECT p.profile_image_url, p.video_url, p.is_profile_video, p.last_active_at
    FROM public.profiles p
    WHERE p.user_id = p_applicant_id;
  ELSE
    RETURN;
  END IF;
END;
$$;