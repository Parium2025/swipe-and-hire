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
    -- Externa visningar (samma definition som statistiksidan): interna
    -- visningar från egna organisationen räknas aldrig med.
    COALESCE((
      SELECT COUNT(*) FROM public.job_views jv
      WHERE jv.job_id IN (SELECT id FROM scoped)
        AND (jv.user_id IS NULL OR jv.user_id NOT IN (SELECT user_id FROM internal))
    ), 0)::bigint,
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
      AND ja.applicant_id NOT IN (SELECT user_id FROM org_members)
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
      AND ja.applicant_id NOT IN (SELECT user_id FROM org_members)
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
     AND i.status NOT IN ('cancelled', 'declined')
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

DROP FUNCTION IF EXISTS public.get_employer_analytics(uuid);

CREATE OR REPLACE FUNCTION public.get_employer_jobs_page(p_scope text DEFAULT 'personal'::text, p_status text DEFAULT 'active'::text, p_search text DEFAULT NULL::text, p_sort text DEFAULT 'newest'::text, p_recruiter_id uuid DEFAULT NULL::uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_offset int;
  v_limit int;
  v_tsquery tsquery;
  v_total int := 0;
  v_jobs json;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('jobs', '[]'::json, 'total', 0);
  END IF;

  v_limit := GREATEST(1, LEAST(p_page_size, 100));
  v_offset := GREATEST(0, (GREATEST(1, p_page) - 1) * v_limit);

  IF p_scope = 'organization' THEN
    v_org_id := get_user_organization_id(v_user_id);
  END IF;

  IF p_search IS NOT NULL AND length(trim(p_search)) > 0 THEN
    BEGIN
      v_tsquery := to_tsquery('simple',
        array_to_string(
          array(
            SELECT word || ':*'
            FROM unnest(string_to_array(
              regexp_replace(trim(p_search), '[&|!:*()''<>\\\-]', '', 'g'),
              ' '
            )) AS word
            WHERE word <> ''
          ),
          ' & '
        )
      );
    EXCEPTION WHEN OTHERS THEN
      v_tsquery := NULL;
    END;
  END IF;

  WITH scoped AS (
    SELECT jp.*
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
      -- Samma status-regler som get_employer_jobs_counts och src/lib/jobStatus.ts:
      -- en annons kan bara vara utgången om den någon gång publicerats.
      AND (
        (p_status = 'active'
          AND jp.is_active = true
          AND NOT (jp.published_at IS NOT NULL AND jp.expires_at IS NOT NULL AND jp.expires_at < now()))
        OR (p_status = 'expired'
          AND jp.published_at IS NOT NULL
          AND jp.expires_at IS NOT NULL
          AND jp.expires_at < now())
        OR (p_status = 'draft'
          AND jp.is_active = false
          AND NOT (jp.published_at IS NOT NULL AND jp.expires_at IS NOT NULL AND jp.expires_at < now()))
      )
      AND (p_recruiter_id IS NULL OR jp.employer_id = p_recruiter_id)
      AND (v_tsquery IS NULL OR jp.search_vector @@ v_tsquery)
  ),
  counted AS (
    SELECT COUNT(*)::int AS total FROM scoped
  ),
  ordered AS (
    SELECT s.*
    FROM scoped s
    ORDER BY
      CASE WHEN p_sort = 'oldest'      THEN s.created_at END ASC,
      CASE WHEN p_sort = 'title-asc'   THEN s.title       END ASC,
      CASE WHEN p_sort = 'title-desc'  THEN s.title       END DESC,
      CASE WHEN p_sort NOT IN ('oldest','title-asc','title-desc') THEN s.created_at END DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE((
      SELECT json_agg(row_to_json(o))
      FROM (
        SELECT
          o.id, o.title, o.description, o.requirements, o.location,
          o.salary_min, o.salary_max, o.salary_type, o.salary_transparency,
          o.employment_type, o.work_schedule, o.work_start_time, o.work_end_time,
          o.positions_count, o.workplace_city, o.workplace_address, o.workplace_postal_code,
          o.workplace_county, o.workplace_municipality, o.workplace_name,
          o.contact_email, o.application_instructions,
          o.is_active, o.views_count, o.applications_count,
          o.created_at, o.updated_at, o.expires_at,
          o.employer_id, o.job_image_url, o.company_logo_url, o.image_focus_position,
          o.job_image_card_url, o.job_image_desktop_url,
          json_build_object(
            'first_name', p.first_name,
            'last_name',  p.last_name
          ) AS employer_profile
        FROM ordered o
        LEFT JOIN public.profiles p ON p.user_id = o.employer_id
      ) o
    ), '[]'::json)
  INTO v_total, v_jobs;

  RETURN json_build_object(
    'jobs', v_jobs,
    'total', v_total,
    'page', GREATEST(1, p_page),
    'page_size', v_limit
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_employer_dashboard_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employer_dashboard_stats(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_employer_advanced_analytics(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employer_advanced_analytics(uuid, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_employer_jobs_page(text, text, text, text, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employer_jobs_page(text, text, text, text, uuid, integer, integer) TO authenticated;