CREATE OR REPLACE FUNCTION public.get_employer_jobs_counts(p_scope text DEFAULT 'personal'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT jp.is_active, jp.expires_at, jp.published_at
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
  ), classified AS (
    SELECT
      (published_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at < now()) AS is_expired,
      is_active
    FROM scoped
  )
  SELECT
    COUNT(*) FILTER (WHERE NOT is_expired AND is_active = true)::int,
    COUNT(*) FILTER (WHERE is_expired)::int,
    COUNT(*) FILTER (WHERE NOT is_expired AND is_active IS DISTINCT FROM true)::int,
    COUNT(*)::int
  INTO v_active, v_expired, v_draft, v_total
  FROM classified;

  RETURN json_build_object(
    'active', v_active,
    'expired', v_expired,
    'draft', v_draft,
    'total', v_total
  );
END;
$function$;

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

  IF p_scope = 'organization' THEN
    v_org_id := get_user_organization_id(v_user_id);
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _noop_stats (x int) ON COMMIT DROP;

  WITH scoped AS (
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