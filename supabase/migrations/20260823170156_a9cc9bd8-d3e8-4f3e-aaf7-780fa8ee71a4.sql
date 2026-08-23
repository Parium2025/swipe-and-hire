CREATE OR REPLACE FUNCTION public.get_job_market_counts()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH live AS (
    SELECT jp.employer_id, jp.created_at
    FROM public.job_postings jp
    WHERE jp.deleted_at IS NULL
      AND jp.is_active = true
      AND jp.published_at IS NOT NULL
      AND (jp.expires_at IS NULL OR jp.expires_at > now())
  )
  SELECT json_build_object(
    'total_jobs', (SELECT COUNT(*)::int FROM live),
    'unique_companies', (SELECT COUNT(DISTINCT employer_id)::int FROM live),
    'new_this_week', (SELECT COUNT(*)::int FROM live WHERE created_at > now() - interval '7 days')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_job_market_counts() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.count_distinct_candidates_scoped(p_scope text DEFAULT 'personal')
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_count int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_scope = 'organization' THEN
    v_org_id := get_user_organization_id(v_user_id);
  END IF;

  SELECT COUNT(DISTINCT ja.applicant_id)::int
  INTO v_count
  FROM public.job_applications ja
  JOIN public.job_postings jp ON jp.id = ja.job_id
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

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_distinct_candidates_scoped(text) TO authenticated, service_role;