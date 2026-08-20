CREATE OR REPLACE FUNCTION public.get_employer_advanced_analytics(p_user_id uuid, p_days_back integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_since timestamptz;
  v_result json;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN '{}'::json;
  END IF;

  v_org_id := get_user_organization_id(p_user_id);
  v_since := CASE
    WHEN p_days_back IS NOT NULL THEN now() - (p_days_back || ' days')::interval
    ELSE '1970-01-01'::timestamptz
  END;

  WITH org_members AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE v_org_id IS NOT NULL
      AND ur.organization_id = v_org_id
      AND ur.is_active = true
    UNION
    SELECT p_user_id
  ),
  org_jobs AS (
    SELECT jp.id, jp.created_at, jp.title, jp.is_active, jp.expires_at
    FROM public.job_postings jp
    WHERE jp.deleted_at IS NULL
      AND (
        jp.employer_id = p_user_id
        OR jp.employer_id IN (SELECT user_id FROM org_members WHERE user_id <> p_user_id)
      )
  ),
  period_views AS (
    SELECT jv.job_id, count(*)::int AS views
    FROM public.job_views jv
    JOIN org_jobs oj ON oj.id = jv.job_id
    WHERE jv.viewed_at >= v_since
      AND (jv.user_id IS NULL OR jv.user_id NOT IN (SELECT user_id FROM org_members))
    GROUP BY jv.job_id
  ),
  period_applications AS (
    SELECT ja.job_id, count(*)::int AS applications
    FROM public.job_applications ja
    JOIN org_jobs oj ON oj.id = ja.job_id
    WHERE ja.applied_at >= v_since
    GROUP BY ja.job_id
  ),
  app_patterns AS (
    SELECT
      extract(dow from ja.applied_at AT TIME ZONE 'Europe/Stockholm')::int AS day_of_week,
      extract(hour from ja.applied_at AT TIME ZONE 'Europe/Stockholm')::int AS hour_of_day,
      count(*)::int AS count
    FROM public.job_applications ja
    JOIN org_jobs oj ON oj.id = ja.job_id
    WHERE ja.applied_at >= v_since
      AND ja.applied_at IS NOT NULL
    GROUP BY 1, 2
  ),
  first_interview_per_application AS (
    SELECT
      ja.id AS application_id,
      ja.applied_at,
      min(i.created_at::timestamptz) AS first_interview_at
    FROM public.job_applications ja
    JOIN org_jobs oj ON oj.id = ja.job_id
    JOIN public.interviews i
      ON i.applicant_id = ja.applicant_id
     AND i.job_id = ja.job_id
     AND i.status <> 'cancelled'
    WHERE ja.applied_at IS NOT NULL
      AND ja.applied_at >= v_since
      AND i.created_at >= v_since
      AND i.created_at >= ja.applied_at
    GROUP BY ja.id, ja.applied_at
  ),
  recruitment_times AS (
    SELECT
      avg(extract(epoch from (first_interview_at - applied_at::timestamptz)))::int AS avg_seconds,
      min(extract(epoch from (first_interview_at - applied_at::timestamptz)))::int AS min_seconds,
      max(extract(epoch from (first_interview_at - applied_at::timestamptz)))::int AS max_seconds,
      count(*)::int AS sample_count
    FROM first_interview_per_application
  ),
  dropoff AS (
    SELECT
      oj.id AS job_id,
      oj.title,
      pv.views,
      COALESCE(pa.applications, 0) AS applications,
      oj.is_active,
      oj.expires_at
    FROM org_jobs oj
    JOIN period_views pv ON pv.job_id = oj.id
    LEFT JOIN period_applications pa ON pa.job_id = oj.id
    WHERE pv.views > 0
    ORDER BY
      (COALESCE(pa.applications, 0)::float / GREATEST(pv.views, 1)) ASC,
      pv.views DESC
  )
  SELECT json_build_object(
    'application_patterns', COALESCE((
      SELECT json_agg(json_build_object(
        'day_of_week', day_of_week,
        'hour_of_day', hour_of_day,
        'count', count
      ))
      FROM app_patterns
    ), '[]'::json),
    'recruitment_time', (
      SELECT json_build_object(
        'avg_seconds', COALESCE(avg_seconds, 0),
        'min_seconds', COALESCE(min_seconds, 0),
        'max_seconds', COALESCE(max_seconds, 0),
        'sample_count', COALESCE(sample_count, 0)
      )
      FROM recruitment_times
    ),
    'dropoff_jobs', COALESCE((
      SELECT json_agg(json_build_object(
        'job_id', job_id,
        'title', title,
        'views', views,
        'applications', applications,
        'is_active', is_active,
        'expires_at', expires_at
      ))
      FROM dropoff
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;