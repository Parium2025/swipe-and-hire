ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE public.job_postings
SET published_at = created_at
WHERE published_at IS NULL AND is_active = true;

CREATE OR REPLACE FUNCTION public.set_job_published_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS TRUE AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_job_published_at ON public.job_postings;
CREATE TRIGGER trg_set_job_published_at
BEFORE INSERT OR UPDATE OF is_active ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.set_job_published_at();

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
    FROM public.user_roles ur
    WHERE v_org_id IS NOT NULL
      AND ur.organization_id = v_org_id
      AND ur.is_active = true
    UNION
    SELECT p_user_id
  ),
  org_job_ids AS (
    SELECT jp.id, jp.created_at AS job_created_at, jp.employer_id, jp.expires_at
    FROM public.job_postings jp
    WHERE jp.deleted_at IS NULL
      AND (
        jp.employer_id = p_user_id
        OR jp.employer_id IN (SELECT user_id FROM org_members WHERE user_id <> p_user_id)
      )
  ),
  filtered_views AS (
    SELECT jv.job_id, jv.device_type, jv.os_type, jv.viewed_at::date AS view_date, jv.viewed_at
    FROM public.job_views jv
    JOIN org_job_ids oji ON oji.id = jv.job_id
    WHERE jv.viewed_at >= v_cutoff
      AND (jv.user_id IS NULL OR jv.user_id NOT IN (SELECT user_id FROM org_members))
  ),
  prev_views AS (
    SELECT count(*)::int AS cnt
    FROM public.job_views jv
    JOIN org_job_ids oji ON oji.id = jv.job_id
    WHERE jv.viewed_at >= v_prev_cutoff
      AND jv.viewed_at < v_cutoff
      AND (jv.user_id IS NULL OR jv.user_id NOT IN (SELECT user_id FROM org_members))
  ),
  filtered_applications AS (
    SELECT ja.job_id, ja.applied_at
    FROM public.job_applications ja
    JOIN org_job_ids oji ON oji.id = ja.job_id
    WHERE ja.applied_at >= v_cutoff
  ),
  prev_applications AS (
    SELECT count(*)::int AS cnt
    FROM public.job_applications ja
    JOIN org_job_ids oji ON oji.id = ja.job_id
    WHERE ja.applied_at >= v_prev_cutoff
      AND ja.applied_at < v_cutoff
  ),
  filtered_interviews AS (
    SELECT i.job_id
    FROM public.interviews i
    JOIN org_job_ids oji ON oji.id = i.job_id
    WHERE i.created_at >= v_cutoff
      AND i.status <> 'cancelled'
  ),
  prev_interviews AS (
    SELECT count(*)::int AS cnt
    FROM public.interviews i
    JOIN org_job_ids oji ON oji.id = i.job_id
    WHERE i.created_at >= v_prev_cutoff
      AND i.created_at < v_cutoff
      AND i.status <> 'cancelled'
  ),
  view_counts AS (
    SELECT fv.job_id, count(*)::int AS views_count
    FROM filtered_views fv
    GROUP BY fv.job_id
  ),
  application_counts AS (
    SELECT fa.job_id, count(*)::int AS applications_count
    FROM filtered_applications fa
    GROUP BY fa.job_id
  ),
  interview_counts AS (
    SELECT fi.job_id, count(*)::int AS interviews_count
    FROM filtered_interviews fi
    GROUP BY fi.job_id
  ),
  job_stats AS (
    SELECT
      jp.id,
      jp.title,
      jp.is_active,
      jp.created_at,
      COALESCE(vc.views_count, 0) AS views_count,
      COALESCE(ac.applications_count, 0) AS applications_count,
      COALESCE(ic.interviews_count, 0) AS interviews_count
    FROM public.job_postings jp
    JOIN org_job_ids oji ON oji.id = jp.id
    LEFT JOIN view_counts vc ON vc.job_id = jp.id
    LEFT JOIN application_counts ac ON ac.job_id = jp.id
    LEFT JOIN interview_counts ic ON ic.job_id = jp.id
  ),
  device_stats AS (
    SELECT COALESCE(device_type, 'unknown') AS device, count(*)::int AS cnt
    FROM filtered_views
    GROUP BY COALESCE(device_type, 'unknown')
  ),
  os_stats AS (
    SELECT COALESCE(os_type, 'unknown') AS os, count(*)::int AS cnt
    FROM filtered_views
    GROUP BY COALESCE(os_type, 'unknown')
  ),
  daily_stats AS (
    SELECT view_date, count(*)::int AS cnt
    FROM filtered_views
    GROUP BY view_date
    ORDER BY view_date ASC
  ),
  best_day_stats AS (
    SELECT EXTRACT(DOW FROM viewed_at AT TIME ZONE 'Europe/Stockholm')::int AS dow, count(*)::int AS cnt
    FROM filtered_views
    GROUP BY EXTRACT(DOW FROM viewed_at AT TIME ZONE 'Europe/Stockholm')
    ORDER BY cnt DESC
    LIMIT 1
  ),
  ttfa AS (
    SELECT
      jp.id AS job_id,
      jp.title,
      COALESCE(jp.published_at, jp.created_at) AS published_at,
      jp.expires_at,
      MIN(ja.applied_at) AS first_application_at,
      EXTRACT(EPOCH FROM (MIN(ja.applied_at) - COALESCE(jp.published_at, jp.created_at)))::int AS seconds_to_first
    FROM org_job_ids oji
    JOIN public.job_postings jp ON jp.id = oji.id
    JOIN public.job_applications ja ON ja.job_id = jp.id
    WHERE jp.is_active IS NOT NULL
      AND ja.applied_at >= COALESCE(jp.published_at, jp.created_at)
    GROUP BY jp.id, jp.title, jp.published_at, jp.created_at, jp.expires_at
    HAVING MIN(ja.applied_at) IS NOT NULL
       AND MIN(ja.applied_at) >= v_cutoff
    ORDER BY COALESCE(jp.published_at, jp.created_at) DESC
  ),
  trend_data AS (
    SELECT json_build_object(
      'current_views', (SELECT count(*)::int FROM filtered_views),
      'prev_views', (SELECT cnt FROM prev_views),
      'current_applications', (SELECT count(*)::int FROM filtered_applications),
      'prev_applications', (SELECT cnt FROM prev_applications),
      'current_interviews', (SELECT count(*)::int FROM filtered_interviews),
      'prev_interviews', (SELECT cnt FROM prev_interviews)
    ) AS data
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