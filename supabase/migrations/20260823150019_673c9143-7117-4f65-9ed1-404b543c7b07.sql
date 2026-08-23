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