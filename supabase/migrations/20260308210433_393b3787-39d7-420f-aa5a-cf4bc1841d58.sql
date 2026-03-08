
-- Add device_type column to job_views
ALTER TABLE public.job_views ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'unknown';

-- Update record_job_view to accept device_type
CREATE OR REPLACE FUNCTION public.record_job_view(p_job_id uuid, p_user_id uuid, p_device_type text DEFAULT 'unknown')
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

  INSERT INTO job_views (job_id, user_id, device_type)
  VALUES (p_job_id, p_user_id, COALESCE(p_device_type, 'unknown'))
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

-- Create analytics RPC with time filtering and device breakdown
CREATE OR REPLACE FUNCTION public.get_employer_analytics_v2(
  p_user_id uuid,
  p_days_back integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_result json;
  v_cutoff timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN '{"jobs":[],"device_breakdown":[],"daily_views":[]}'::json;
  END IF;

  v_org_id := get_user_organization_id(p_user_id);
  
  IF p_days_back IS NOT NULL THEN
    v_cutoff := now() - (p_days_back || ' days')::interval;
  ELSE
    v_cutoff := '1970-01-01'::timestamptz;
  END IF;

  WITH org_job_ids AS (
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
  filtered_views AS (
    SELECT jv.job_id, jv.device_type, jv.viewed_at::date as view_date
    FROM job_views jv
    WHERE jv.job_id IN (SELECT id FROM org_job_ids)
      AND jv.viewed_at >= v_cutoff
  ),
  filtered_applications AS (
    SELECT ja.job_id, ja.applied_at
    FROM job_applications ja
    WHERE ja.job_id IN (SELECT id FROM org_job_ids)
      AND ja.applied_at >= v_cutoff
  ),
  filtered_interviews AS (
    SELECT i.job_id
    FROM interviews i
    WHERE i.job_id IN (SELECT id FROM org_job_ids)
      AND i.created_at >= v_cutoff
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
  daily_stats AS (
    SELECT 
      view_date,
      count(*)::int as cnt
    FROM filtered_views
    GROUP BY view_date
    ORDER BY view_date ASC
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
    'daily_views', COALESCE((
      SELECT json_agg(json_build_object('date', dss.view_date, 'count', dss.cnt) ORDER BY dss.view_date)
      FROM daily_stats dss
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
