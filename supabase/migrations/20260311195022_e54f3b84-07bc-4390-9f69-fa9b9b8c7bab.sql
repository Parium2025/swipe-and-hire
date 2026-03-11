
CREATE OR REPLACE FUNCTION public.get_employer_advanced_analytics(
  p_user_id uuid,
  p_days_back integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_since timestamptz;
  v_result json;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN '{}'::json;
  END IF;

  v_org_id := get_user_organization_id(p_user_id);
  v_since := CASE WHEN p_days_back IS NOT NULL 
    THEN now() - (p_days_back || ' days')::interval 
    ELSE '1970-01-01'::timestamptz 
  END;

  WITH org_jobs AS (
    SELECT jp.id
    FROM job_postings jp
    WHERE jp.deleted_at IS NULL
      AND (
        jp.employer_id = p_user_id
        OR (v_org_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM user_roles ur 
          WHERE ur.user_id = jp.employer_id 
            AND ur.organization_id = v_org_id 
            AND ur.is_active = true
        ))
      )
  ),
  app_patterns AS (
    SELECT 
      extract(dow from ja.applied_at AT TIME ZONE 'Europe/Stockholm')::int as day_of_week,
      extract(hour from ja.applied_at AT TIME ZONE 'Europe/Stockholm')::int as hour_of_day,
      count(*)::int as count
    FROM job_applications ja
    WHERE ja.job_id IN (SELECT id FROM org_jobs)
      AND ja.applied_at >= v_since
      AND ja.applied_at IS NOT NULL
    GROUP BY 1, 2
  ),
  recruitment_times AS (
    SELECT 
      avg(extract(epoch from (i.created_at::timestamptz - ja.applied_at::timestamptz)))::int as avg_seconds,
      min(extract(epoch from (i.created_at::timestamptz - ja.applied_at::timestamptz)))::int as min_seconds,
      max(extract(epoch from (i.created_at::timestamptz - ja.applied_at::timestamptz)))::int as max_seconds,
      count(*)::int as sample_count
    FROM interviews i
    JOIN job_applications ja ON ja.applicant_id = i.applicant_id AND ja.job_id = i.job_id
    WHERE i.job_id IN (SELECT id FROM org_jobs)
      AND i.status NOT IN ('cancelled')
      AND ja.applied_at >= v_since
      AND ja.applied_at IS NOT NULL
  ),
  dropoff AS (
    SELECT 
      jp.id as job_id,
      jp.title,
      COALESCE(jp.views_count, 0)::int as views,
      COALESCE(jp.applications_count, 0)::int as applications,
      jp.is_active
    FROM job_postings jp
    WHERE jp.id IN (SELECT id FROM org_jobs)
      AND COALESCE(jp.views_count, 0) > 0
      AND jp.created_at >= v_since
    ORDER BY COALESCE(jp.views_count, 0) DESC
    LIMIT 20
  )
  SELECT json_build_object(
    'application_patterns', COALESCE(
      (SELECT json_agg(json_build_object(
        'day_of_week', day_of_week, 
        'hour_of_day', hour_of_day, 
        'count', count
      )) FROM app_patterns), 
      '[]'::json
    ),
    'recruitment_time', (
      SELECT json_build_object(
        'avg_seconds', COALESCE(avg_seconds, 0), 
        'min_seconds', COALESCE(min_seconds, 0), 
        'max_seconds', COALESCE(max_seconds, 0), 
        'sample_count', COALESCE(sample_count, 0)
      ) FROM recruitment_times
    ),
    'dropoff_jobs', COALESCE(
      (SELECT json_agg(json_build_object(
        'job_id', job_id, 
        'title', title, 
        'views', views, 
        'applications', applications, 
        'is_active', is_active
      )) FROM dropoff), 
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
