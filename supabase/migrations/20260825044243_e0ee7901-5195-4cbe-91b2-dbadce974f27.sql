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
    SELECT iv.employer_id,
           count(*)::int AS interviews,
           count(*) FILTER (
             WHERE iv.status IN ('pending','confirmed','completed')
               AND (iv.scheduled_at + make_interval(mins => COALESCE(iv.duration_minutes, 30))) <= now()
           )::int AS interviews_completed
    FROM public.interviews iv
    WHERE iv.employer_id IN (SELECT user_id FROM org_members)
      AND iv.created_at >= v_cutoff
      AND iv.status NOT IN ('cancelled','declined')
      AND (iv.applicant_id IS NULL OR iv.applicant_id NOT IN (SELECT user_id FROM org_members))
    GROUP BY iv.employer_id
  ),
  per_member AS (
    SELECT
      m.user_id,
      COALESCE(NULLIF(TRIM(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')), ''), pr.email, 'Kollega') AS name,
      pr.profile_image_url,
      (SELECT count(*)::int FROM org_jobs oj
        WHERE oj.employer_id = m.user_id
          AND COALESCE(oj.published_at, oj.created_at) >= v_cutoff) AS jobs_count,
      COALESCE((SELECT sum(views)::int FROM v WHERE v.employer_id = m.user_id), 0) AS views,
      COALESCE((SELECT sum(apps)::int FROM a WHERE a.employer_id = m.user_id), 0) AS applications,
      COALESCE((SELECT interviews FROM i WHERE i.employer_id = m.user_id), 0) AS interviews,
      COALESCE((SELECT interviews_completed FROM i WHERE i.employer_id = m.user_id), 0) AS interviews_completed
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
    'members', COALESCE((SELECT json_agg(row_to_json(pm) ORDER BY pm.applications DESC, pm.interviews DESC, pm.views DESC) FROM per_member pm), '[]'::json),
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

REVOKE ALL ON FUNCTION public.get_employer_team_insights(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_employer_team_insights(uuid, integer) TO authenticated;