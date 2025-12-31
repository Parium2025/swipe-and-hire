-- Function to get latest application date for each applicant across the organization
CREATE OR REPLACE FUNCTION public.get_applicant_latest_activity(
  p_applicant_ids uuid[],
  p_employer_id uuid
)
RETURNS TABLE(
  applicant_id uuid,
  latest_application_at timestamp with time zone,
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

  RETURN QUERY
  WITH org_jobs AS (
    -- Get all job IDs that belong to the employer or their organization
    SELECT DISTINCT jp.id as job_id
    FROM job_postings jp
    LEFT JOIN user_roles ur ON ur.user_id = jp.employer_id AND ur.is_active = true
    WHERE jp.employer_id = p_employer_id
       OR (v_employer_org_id IS NOT NULL AND ur.organization_id = v_employer_org_id)
  ),
  latest_applications AS (
    -- Get the latest applied_at for each applicant across org jobs
    SELECT 
      ja.applicant_id,
      MAX(ja.applied_at) as latest_applied
    FROM job_applications ja
    WHERE ja.applicant_id = ANY(p_applicant_ids)
      AND ja.job_id IN (SELECT job_id FROM org_jobs)
    GROUP BY ja.applicant_id
  )
  SELECT 
    la.applicant_id,
    la.latest_applied as latest_application_at,
    p.last_active_at
  FROM latest_applications la
  LEFT JOIN profiles p ON p.user_id = la.applicant_id;
END;
$function$;