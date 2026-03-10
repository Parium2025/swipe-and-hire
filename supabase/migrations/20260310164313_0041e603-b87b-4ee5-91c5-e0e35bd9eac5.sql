-- Add os_type column
ALTER TABLE public.job_views ADD COLUMN IF NOT EXISTS os_type text DEFAULT 'unknown';

-- Update record_job_view to accept os_type
CREATE OR REPLACE FUNCTION public.record_job_view(p_job_id uuid, p_user_id uuid, p_device_type text DEFAULT 'unknown', p_os_type text DEFAULT 'unknown')
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_already_viewed BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM job_views
    WHERE job_id = p_job_id AND user_id = p_user_id
  ) INTO v_already_viewed;

  IF v_already_viewed THEN
    RETURN FALSE;
  END IF;

  INSERT INTO job_views (job_id, user_id, device_type, os_type)
  VALUES (p_job_id, p_user_id, COALESCE(p_device_type, 'unknown'), COALESCE(p_os_type, 'unknown'))
  ON CONFLICT (job_id, user_id) DO NOTHING;

  IF FOUND THEN
    UPDATE job_postings
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = p_job_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$;

-- Update analytics to include os_breakdown
CREATE OR REPLACE FUNCTION public.get_employer_analytics_v2(p_user_id uuid, p_days_back integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_result json;
  v_cutoff timestamptz;
  v_prev_cutoff timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN '{"jobs":[],"device_breakdown":[],"os_breakdown":[],"daily_views":[],"trends":null,"best_day":null,"time_to_first_application":[]}'::json;
  END IF;

  v_org_id := get_user_organization_id(p_user_id);
  
  IF p_days_back IS NOT NULL THEN
    v_cutoff := now() - (p_days_back || ' days')::interval;
    v_prev_cutoff := v_cutoff - (p_days_back || ' days')::interval;
  ELSE
    v_cutoff := '1970-01-01'::timestamptz;
    v_prev_cutoff := '1970-01-01'::timestamptz;
  END IF;

  WITH org_members AS (
    SELECT ur.user_id
    FROM user_roles ur
    WHERE v_org_id IS NOT NULL
      AND ur.organization_id = v_org_id
      AND ur.is_active = true
    UNION
    SELECT p_user_id
  ),
  org_job_ids AS (
    SELECT jp.id, jp.created_at as job_created_at, jp.employer_id
    FROM job_postings jp
    WHERE jp.deleted_at IS NULL
      AND (
        jp.employer_id = p_user_id
        OR jp.employer_id IN (SELECT user_id FROM org_members WHERE user_id <> p_user_id)
      )
  ),
  filtered_views AS (
    SELECT jv.job_id, jv.device_type, jv.os_type, jv.viewed_at::date as view_date, jv.viewed_at
    FROM job_views jv
    WHERE jv.job_id IN (SELECT id FROM org_job_ids)
      AND jv.viewed_at >= v_cutoff
      AND jv.user_id NOT IN (SELECT user_id FROM org_members)
  ),
  prev_views AS (
    SELECT count(*)::int as cnt
    FROM job_views jv
    WHERE jv.job_id IN (SELECT id FROM org_job_ids)
      AND jv.viewed_at >= v_prev_cutoff
      AND jv.viewed_at < v_cutoff
      AND jv.user_id NOT IN (SELECT user_id FROM org_members)
  ),
  filtered_applications AS (
    SELECT ja.job_id, ja.applied_at
    FROM job_applications ja
    WHERE ja.job_id IN (SELECT id FROM org_job_ids)
      AND ja.applied_at >= v_cutoff
  ),
  prev_applications AS (
    SELECT count(*)::int as cnt
    FROM job_applications ja
    WHERE ja.job_id IN (SELECT id FROM org_job_ids)
      AND ja.applied_at >= v_prev_cutoff
      AND ja.applied_at < v_cutoff
  ),
  filtered_interviews AS (
    SELECT i.job_id
    FROM interviews i
    WHERE i.job_id IN (SELECT id FROM org_job_ids)
      AND i.created_at >= v_cutoff
      AND i.status NOT IN ('cancelled')
  ),
  prev_interviews AS (
    SELECT count(*)::int as cnt
    FROM interviews i
    WHERE i.job_id IN (SELECT id FROM org_job_ids)
      AND i.created_at >= v_prev_cutoff
      AND i.created_at < v_cutoff
      AND i.status NOT IN ('cancelled')
  ),
  job_stats AS (
    SELECT 
      jp.id,
      jp.title,
      jp.is_active,
      jp.created_at,
      COALESCE((SELECT count(*) FROM filtered_views fv WHERE fv.job_id = jp.id), 0)::int as views_count,
      COALESCE((SELECT count(*) FROM filtered_applications fa WHERE fa.job_id = jp.id), 0)::int as applications_count,
      COALESCE((SELECT count(*) FROM filtered_interviews fi WHERE fi.job_id = jp.id), 0)::int as interviews_count
    FROM job_postings jp
    WHERE jp.id IN (SELECT id FROM org_job_ids)
  ),
  device_stats AS (
    SELECT 
      COALESCE(device_type, 'unknown') as device,
      count(*)::int as cnt
    FROM filtered_views
    GROUP BY device_type
  ),
  os_stats AS (
    SELECT 
      COALESCE(os_type, 'unknown') as os,
      count(*)::int as cnt
    FROM filtered_views
    GROUP BY os_type
  ),
  daily_stats AS (
    SELECT 
      view_date,
      count(*)::int as cnt
    FROM filtered_views
    GROUP BY view_date
    ORDER BY view_date ASC
  ),
  best_day_stats AS (
    SELECT 
      EXTRACT(DOW FROM viewed_at)::int as dow,
      count(*)::int as cnt
    FROM filtered_views
    GROUP BY EXTRACT(DOW FROM viewed_at)
    ORDER BY cnt DESC
    LIMIT 1
  ),
  ttfa AS (
    SELECT 
      jp.id as job_id,
      jp.title,
      jp.created_at as published_at,
      jp.expires_at,
      MIN(ja.applied_at) as first_application_at,
      EXTRACT(EPOCH FROM (MIN(ja.applied_at) - jp.created_at))::int as seconds_to_first
    FROM org_job_ids oji
    JOIN job_postings jp ON jp.id = oji.id
    JOIN job_applications ja ON ja.job_id = jp.id
    WHERE jp.is_active IS NOT NULL
    GROUP BY jp.id, jp.title, jp.created_at, jp.expires_at
    HAVING MIN(ja.applied_at) IS NOT NULL
    ORDER BY jp.created_at DESC
  ),
  trend_data AS (
    SELECT 
      json_build_object(
        'current_views', (SELECT count(*)::int FROM filtered_views),
        'prev_views', (SELECT cnt FROM prev_views),
        'current_applications', (SELECT count(*)::int FROM filtered_applications),
        'prev_applications', (SELECT cnt FROM prev_applications),
        'current_interviews', (SELECT count(*)::int FROM filtered_interviews),
        'prev_interviews', (SELECT cnt FROM prev_interviews)
      ) as data
  )
  SELECT json_build_object(
    'jobs', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', js.id,
          'title', js.title,
          'views_count', js.views_count,
          'applications_count', js.applications_count,
          'interviews_count', js.interviews_count,
          'created_at', js.created_at,
          'is_active', COALESCE(js.is_active, false)
        )
        ORDER BY js.created_at DESC
      )
      FROM job_stats js
    ), '[]'::json),
    'device_breakdown', COALESCE((
      SELECT json_agg(json_build_object('device', ds.device, 'count', ds.cnt))
      FROM device_stats ds
    ), '[]'::json),
    'os_breakdown', COALESCE((
      SELECT json_agg(json_build_object('os', oss.os, 'count', oss.cnt) ORDER BY oss.cnt DESC)
      FROM os_stats oss
    ), '[]'::json),
    'daily_views', COALESCE((
      SELECT json_agg(json_build_object('date', dss.view_date, 'count', dss.cnt) ORDER BY dss.view_date)
      FROM daily_stats dss
    ), '[]'::json),
    'trends', (SELECT data FROM trend_data),
    'best_day', (
      SELECT json_build_object('day_of_week', dow, 'views', cnt)
      FROM best_day_stats
      LIMIT 1
    ),
    'time_to_first_application', COALESCE((
      SELECT json_agg(
        json_build_object(
          'job_id', t.job_id,
          'title', t.title,
          'published_at', t.published_at,
          'expires_at', t.expires_at,
          'first_application_at', t.first_application_at,
          'seconds_to_first', t.seconds_to_first
        )
        ORDER BY t.published_at DESC
      )
      FROM ttfa t
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;