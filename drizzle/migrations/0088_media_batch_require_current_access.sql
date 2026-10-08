CREATE OR REPLACE FUNCTION public.get_applicant_profile_media_batch(p_applicant_ids uuid[], p_employer_id uuid)
 RETURNS TABLE(applicant_id uuid, profile_image_url text, video_url text, is_profile_video boolean, last_active_at timestamp with time zone, city text, image_updated_at timestamp with time zone, video_updated_at timestamp with time zone, cover_image_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employer_org_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_employer_id THEN
    RETURN;
  END IF;

  v_employer_org_id := public.get_user_organization_id(p_employer_id);

  RETURN QUERY
  WITH authorized_applicants AS (
    SELECT DISTINCT ja.applicant_id
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = ANY(p_applicant_ids)
      AND jp.employer_id = p_employer_id
    UNION
    SELECT DISTINCT ja.applicant_id
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    JOIN public.user_roles ur ON ur.user_id = jp.employer_id
    WHERE ja.applicant_id = ANY(p_applicant_ids)
      AND v_employer_org_id IS NOT NULL
      AND ur.organization_id = v_employer_org_id
      AND ur.is_active = true
    UNION
    SELECT DISTINCT pvp.profile_id
    FROM public.profile_view_permissions pvp
    WHERE pvp.profile_id = ANY(p_applicant_ids)
      AND pvp.viewer_id = p_employer_id
      AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
    UNION
    -- Saved candidates only while the saver still has access to the application.
    SELECT DISTINCT mc.applicant_id
    FROM public.my_candidates mc
    JOIN public.job_applications ja ON ja.id = mc.application_id
    WHERE mc.applicant_id = ANY(p_applicant_ids)
      AND mc.recruiter_id = p_employer_id
      AND public.can_view_job_application(ja.job_id)
  )
  SELECT p.user_id, p.profile_image_url, p.video_url, p.is_profile_video, p.last_active_at, p.city, p.image_updated_at, p.video_updated_at, p.cover_image_url
  FROM public.profiles p
  WHERE p.user_id IN (SELECT aa.applicant_id FROM authorized_applicants aa);
END;
$function$;