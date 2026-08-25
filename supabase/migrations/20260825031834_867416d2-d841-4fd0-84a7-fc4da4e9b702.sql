-- 1) Logga aldrig interna visningar (annonsägaren själv eller kollega i samma org)
CREATE OR REPLACE FUNCTION public.record_job_view(p_job_id uuid, p_user_id uuid, p_device_type text DEFAULT 'unknown'::text, p_os_type text DEFAULT 'unknown'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employer_id uuid;
  v_owner_org uuid;
  v_viewer_org uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN FALSE;
  END IF;

  SELECT jp.employer_id INTO v_employer_id
  FROM job_postings jp WHERE jp.id = p_job_id;

  IF v_employer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Intern visning: annonsägaren själv
  IF v_employer_id = p_user_id THEN
    RETURN FALSE;
  END IF;

  -- Intern visning: kollega i samma organisation
  v_owner_org := get_user_organization_id(v_employer_id);
  v_viewer_org := get_user_organization_id(p_user_id);
  IF v_owner_org IS NOT NULL AND v_owner_org = v_viewer_org THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (SELECT 1 FROM job_views WHERE job_id = p_job_id AND user_id = p_user_id) THEN
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

-- 2) Teamstatistik: exkludera interna ansökningar och intervjuer
CREATE OR REPLACE FUNCTION public.get_employer_team_insights(p_user_id uuid, p_days_back integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_cutoff timestamptz;
  v_result json;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN '{"members":[],"top_traits":null}'::json;
  END IF;

  v_org_id := get_user_organization_id(p_user_id);

  IF p_days_back IS NOT NULL THEN
    v_cutoff := now() - (p_days_back || ' days')::interval;
  ELSE
    v_cutoff := '1970-01-01'::timestamptz;
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
  org_jobs AS (
    SELECT jp.id, jp.employer_id, jp.title, jp.published_at, jp.created_at, jp.description
    FROM public.job_postings jp
    WHERE jp.deleted_at IS NULL
      AND jp.employer_id IN (SELECT user_id FROM org_members)
      AND COALESCE(jp.published_at, jp.created_at) >= v_cutoff
  ),
  v AS (
    SELECT oj.employer_id, oj.id AS job_id, count(jv.*)::int AS views
    FROM org_jobs oj
    LEFT JOIN public.job_views jv
      ON jv.job_id = oj.id
     AND jv.viewed_at >= v_cutoff
     AND (jv.user_id IS NULL OR jv.user_id NOT IN (SELECT user_id FROM org_members))
    GROUP BY oj.employer_id, oj.id
  ),
  a AS (
    SELECT oj.employer_id, oj.id AS job_id, count(ja.*)::int AS apps
    FROM org_jobs oj
    LEFT JOIN public.job_applications ja
      ON ja.job_id = oj.id
     AND ja.applied_at >= v_cutoff
     AND ja.applicant_id NOT IN (SELECT user_id FROM org_members)
    GROUP BY oj.employer_id, oj.id
  ),
  i AS (
    SELECT oj.employer_id, count(iv.*)::int AS interviews
    FROM org_jobs oj
    LEFT JOIN public.interviews iv
      ON iv.job_id = oj.id
     AND iv.created_at >= v_cutoff
     AND iv.status <> 'cancelled'
     AND (iv.applicant_id IS NULL OR iv.applicant_id NOT IN (SELECT user_id FROM org_members))
    GROUP BY oj.employer_id
  ),
  per_member AS (
    SELECT
      m.user_id,
      COALESCE(NULLIF(TRIM(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')), ''), pr.email, 'Kollega') AS name,
      pr.profile_image_url,
      (SELECT count(*)::int FROM org_jobs oj WHERE oj.employer_id = m.user_id) AS jobs_count,
      COALESCE((SELECT sum(views)::int FROM v WHERE v.employer_id = m.user_id), 0) AS views,
      COALESCE((SELECT sum(apps)::int FROM a WHERE a.employer_id = m.user_id), 0) AS applications,
      COALESCE((SELECT interviews FROM i WHERE i.employer_id = m.user_id), 0) AS interviews
    FROM org_members m
    LEFT JOIN public.profiles pr ON pr.user_id = m.user_id
  ),
  job_perf AS (
    SELECT oj.id, oj.title, oj.employer_id,
           COALESCE(v.views,0) AS views,
           COALESCE(a.apps,0) AS apps,
           length(COALESCE(oj.description,'')) AS desc_len,
           EXTRACT(dow FROM COALESCE(oj.published_at, oj.created_at) AT TIME ZONE 'Europe/Stockholm')::int AS dow
    FROM org_jobs oj
    LEFT JOIN v ON v.job_id = oj.id
    LEFT JOIN a ON a.job_id = oj.id
  ),
  top_jobs AS (
    SELECT * FROM job_perf WHERE views >= 3 ORDER BY (apps::numeric / NULLIF(views,0)) DESC NULLS LAST LIMIT 5
  )
  SELECT json_build_object(
    'members', COALESCE((SELECT json_agg(row_to_json(pm) ORDER BY pm.applications DESC, pm.views DESC) FROM per_member pm), '[]'::json),
    'top_traits', (SELECT json_build_object(
        'sample', count(*)::int,
        'avg_description_length', COALESCE(round(avg(desc_len))::int, 0),
        'best_day_of_week', (SELECT dow FROM top_jobs GROUP BY dow ORDER BY count(*) DESC LIMIT 1),
        'avg_conversion', COALESCE(round(avg(apps::numeric / NULLIF(views,0)) * 100, 1), 0),
        'examples', COALESCE((SELECT json_agg(json_build_object('title', tj.title, 'views', tj.views, 'applications', tj.apps, 'employer_id', tj.employer_id)) FROM top_jobs tj), '[]'::json)
      ) FROM top_jobs)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 3) Startsidans totalsiffra: exkludera interna ansökningar
CREATE OR REPLACE FUNCTION public.get_employer_dashboard_stats(p_scope text DEFAULT 'personal'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_total_views bigint := 0;
  v_total_apps bigint := 0;
  v_active int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('active_jobs', 0, 'total_views', 0, 'total_applications', 0);
  END IF;

  v_org_id := get_user_organization_id(v_user_id);

  WITH internal AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE v_org_id IS NOT NULL
      AND ur.organization_id = v_org_id
      AND ur.is_active = true
    UNION
    SELECT v_user_id
  ),
  scoped AS (
    SELECT jp.id, jp.is_active, jp.expires_at, jp.published_at, jp.views_count
    FROM public.job_postings jp
    WHERE jp.deleted_at IS NULL
      AND (
        (p_scope = 'organization' AND v_org_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = jp.employer_id
            AND ur.organization_id = v_org_id
            AND ur.is_active = true
        ))
        OR (p_scope <> 'organization' AND jp.employer_id = v_user_id)
        OR (p_scope = 'organization' AND v_org_id IS NULL AND jp.employer_id = v_user_id)
      )
  )
  SELECT
    COUNT(*) FILTER (
      WHERE s.is_active = true
        AND NOT (s.published_at IS NOT NULL AND s.expires_at IS NOT NULL AND s.expires_at < now())
    )::int,
    COALESCE(SUM(s.views_count), 0)::bigint,
    COALESCE((
      SELECT COUNT(*) FROM public.job_applications ja
      WHERE ja.job_id IN (SELECT id FROM scoped)
        AND ja.applicant_id NOT IN (SELECT user_id FROM internal)
    ), 0)::bigint
  INTO v_active, v_total_views, v_total_apps
  FROM scoped s;

  RETURN json_build_object(
    'active_jobs', v_active,
    'total_views', v_total_views,
    'total_applications', v_total_apps
  );
END;
$function$;