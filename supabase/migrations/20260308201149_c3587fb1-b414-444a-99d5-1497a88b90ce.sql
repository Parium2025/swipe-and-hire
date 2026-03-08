
CREATE OR REPLACE FUNCTION public.get_employer_analytics(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_result json;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN '{"jobs":[]}'::json;
  END IF;

  v_org_id := get_user_organization_id(p_user_id);

  WITH org_jobs AS (
    SELECT jp.id, jp.title, jp.views_count, jp.applications_count, jp.created_at, jp.is_active
    FROM job_postings jp
    WHERE jp.deleted_at IS NULL
      AND (
        jp.employer_id = p_user_id
        OR (
          v_org_id IS NOT NULL 
          AND EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = jp.employer_id 
              AND ur.organization_id = v_org_id 
              AND ur.is_active = true
          )
        )
      )
    ORDER BY jp.created_at DESC
  ),
  interview_counts AS (
    SELECT i.job_id, COUNT(*)::int as cnt
    FROM interviews i
    WHERE i.job_id IN (SELECT oj.id FROM org_jobs oj)
      AND i.status NOT IN ('cancelled')
    GROUP BY i.job_id
  )
  SELECT json_build_object(
    'jobs', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', oj.id,
          'title', oj.title,
          'views_count', COALESCE(oj.views_count, 0),
          'applications_count', COALESCE(oj.applications_count, 0),
          'interviews_count', COALESCE(ic.cnt, 0),
          'created_at', oj.created_at,
          'is_active', COALESCE(oj.is_active, false)
        )
        ORDER BY oj.created_at DESC
      )
      FROM org_jobs oj
      LEFT JOIN interview_counts ic ON ic.job_id = oj.id
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
