CREATE OR REPLACE FUNCTION public.get_employer_unviewed_application_counts()
RETURNS TABLE(job_id uuid, unviewed_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  org AS (SELECT public.get_user_organization_id((SELECT uid FROM me)) AS org_id),
  internal AS (
    SELECT ur.user_id
    FROM public.user_roles ur, org
    WHERE org.org_id IS NOT NULL
      AND ur.organization_id = org.org_id
      AND ur.is_active = true
    UNION
    SELECT uid FROM me
  ),
  allowed AS (
    SELECT jp.id
    FROM public.job_postings jp
    WHERE (SELECT uid FROM me) IS NOT NULL
      AND jp.deleted_at IS NULL
      AND (
        jp.employer_id = (SELECT uid FROM me)
        OR jp.employer_id IN (SELECT user_id FROM internal)
      )
  )
  SELECT ja.job_id, count(*)::int
  FROM public.job_applications ja
  WHERE ja.job_id IN (SELECT id FROM allowed)
    AND ja.viewed_at IS NULL
    AND ja.hidden_by_applicant_at IS NULL
    AND ja.applicant_id NOT IN (SELECT user_id FROM internal)
  GROUP BY ja.job_id;
$function$;

REVOKE ALL ON FUNCTION public.get_employer_unviewed_application_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employer_unviewed_application_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_unviewed_application_counts() TO service_role;