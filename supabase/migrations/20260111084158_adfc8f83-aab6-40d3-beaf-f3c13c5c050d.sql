-- Create a batch function to fetch profile media for multiple applicants at once
-- This replaces N individual RPC calls with 1 single call for better scalability

CREATE OR REPLACE FUNCTION public.get_applicant_profile_media_batch(
  p_applicant_ids uuid[], 
  p_employer_id uuid
)
RETURNS TABLE(
  applicant_id uuid,
  profile_image_url text, 
  video_url text, 
  is_profile_video boolean, 
  last_active_at timestamp with time zone
)
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

  -- Return profile media for all applicants that the employer has permission to view
  RETURN QUERY
  WITH authorized_applicants AS (
    -- Applicants who applied to employer's own jobs
    SELECT DISTINCT ja.applicant_id
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = ANY(p_applicant_ids)
      AND jp.employer_id = p_employer_id
    
    UNION
    
    -- Applicants who applied to jobs from same organization
    SELECT DISTINCT ja.applicant_id
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    JOIN public.user_roles ur ON ur.user_id = jp.employer_id
    WHERE ja.applicant_id = ANY(p_applicant_ids)
      AND v_employer_org_id IS NOT NULL
      AND ur.organization_id = v_employer_org_id
      AND ur.is_active = true
    
    UNION
    
    -- Applicants with explicit view permission
    SELECT DISTINCT pvp.profile_id as applicant_id
    FROM public.profile_view_permissions pvp
    WHERE pvp.profile_id = ANY(p_applicant_ids)
      AND pvp.viewer_id = p_employer_id
      AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  )
  SELECT 
    p.user_id as applicant_id,
    p.profile_image_url,
    p.video_url,
    p.is_profile_video,
    p.last_active_at
  FROM public.profiles p
  WHERE p.user_id IN (SELECT aa.applicant_id FROM authorized_applicants aa);
END;
$function$;