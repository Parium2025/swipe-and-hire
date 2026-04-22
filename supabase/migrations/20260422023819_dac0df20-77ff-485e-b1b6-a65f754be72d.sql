-- ============================================
-- Skalbarhets-index för arbetsgivar-listning
-- ============================================
CREATE INDEX IF NOT EXISTS idx_job_postings_employer_status_created
  ON public.job_postings (employer_id, is_active, expires_at, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================
-- RPC: Counts för aktiva / utgångna / utkast
-- ============================================
CREATE OR REPLACE FUNCTION public.get_employer_jobs_counts(
  p_scope text DEFAULT 'personal'  -- 'personal' eller 'organization'
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_active int := 0;
  v_expired int := 0;
  v_draft int := 0;
  v_total int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('active', 0, 'expired', 0, 'draft', 0, 'total', 0);
  END IF;

  IF p_scope = 'organization' THEN
    v_org_id := get_user_organization_id(v_user_id);
  END IF;

  WITH scoped AS (
    SELECT jp.is_active, jp.expires_at
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
    COUNT(*) FILTER (WHERE is_active = true AND (expires_at IS NULL OR expires_at >= now()))::int,
    COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < now())::int,
    COUNT(*) FILTER (WHERE is_active = false AND (expires_at IS NULL OR expires_at >= now()))::int,
    COUNT(*)::int
  INTO v_active, v_expired, v_draft, v_total
  FROM scoped;

  RETURN json_build_object(
    'active', v_active,
    'expired', v_expired,
    'draft', v_draft,
    'total', v_total
  );
END;
$$;

-- ============================================
-- RPC: Aggregerad statistik (views, applications)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_employer_dashboard_stats(
  p_scope text DEFAULT 'personal'
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  IF p_scope = 'organization' THEN
    v_org_id := get_user_organization_id(v_user_id);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE jp.is_active = true AND (jp.expires_at IS NULL OR jp.expires_at >= now()))::int,
    COALESCE(SUM(jp.views_count) FILTER (WHERE jp.is_active = true AND (jp.expires_at IS NULL OR jp.expires_at >= now())), 0)::bigint,
    COALESCE(SUM(jp.applications_count) FILTER (WHERE jp.is_active = true AND (jp.expires_at IS NULL OR jp.expires_at >= now())), 0)::bigint
  INTO v_active, v_total_views, v_total_apps
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
    );

  RETURN json_build_object(
    'active_jobs', v_active,
    'total_views', v_total_views,
    'total_applications', v_total_apps
  );
END;
$$;

-- ============================================
-- RPC: Paginerad lista per status, med sök/sort/filter
-- ============================================
CREATE OR REPLACE FUNCTION public.get_employer_jobs_page(
  p_scope text DEFAULT 'personal',          -- 'personal' | 'organization'
  p_status text DEFAULT 'active',           -- 'active' | 'expired' | 'draft'
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'newest',             -- 'newest' | 'oldest' | 'title-asc' | 'title-desc'
  p_recruiter_id uuid DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Build tsquery for full-text search
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
      AND (
        (p_status = 'active'  AND jp.is_active = true  AND (jp.expires_at IS NULL OR jp.expires_at >= now()))
        OR (p_status = 'expired' AND jp.expires_at IS NOT NULL AND jp.expires_at < now())
        OR (p_status = 'draft'   AND jp.is_active = false AND (jp.expires_at IS NULL OR jp.expires_at >= now()))
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
$$;

-- ============================================
-- Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_employer_jobs_counts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_dashboard_stats(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_jobs_page(text, text, text, text, uuid, int, int) TO authenticated;