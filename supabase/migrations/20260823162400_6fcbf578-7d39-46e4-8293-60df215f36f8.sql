CREATE OR REPLACE FUNCTION public.search_employer_jobs(p_search text DEFAULT NULL::text, p_status text DEFAULT 'all'::text, p_recruiter_id uuid DEFAULT NULL::uuid, p_sort text DEFAULT 'newest'::text, p_limit integer DEFAULT 18, p_offset integer DEFAULT 0)
 RETURNS TABLE(job_id uuid, total_count bigint, relevance real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_q text := NULLIF(btrim(coalesce(p_search, '')), '');
  v_norm text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT organization_id INTO v_org FROM public.profiles WHERE id = v_uid;
  v_norm := lower(public.unaccent(coalesce(v_q, '')));

  RETURN QUERY
  WITH scoped AS (
    SELECT j.*,
           (j.published_at IS NOT NULL AND j.expires_at IS NOT NULL AND j.expires_at < now()) AS is_expired_calc,
           lower(public.unaccent(
             coalesce(j.title,'') || ' ' || coalesce(j.location,'') || ' ' ||
             coalesce(j.workplace_city,'') || ' ' || coalesce(j.workplace_name,'') || ' ' ||
             coalesce(j.workplace_address,'') || ' ' || coalesce(j.workplace_postal_code,'') || ' ' ||
             coalesce(j.occupation,'') || ' ' || coalesce(j.category,'') || ' ' ||
             coalesce(j.employment_type,'') || ' ' || coalesce(j.work_schedule,'') || ' ' ||
             coalesce(j.work_location_type,'') || ' ' || coalesce(j.remote_work_possible,'') || ' ' ||
             coalesce(j.salary_type,'') || ' ' || coalesce(j.salary_min::text,'') || ' ' ||
             coalesce(j.salary_max::text,'') || ' ' || coalesce(j.description,'') || ' ' ||
             coalesce(j.requirements,'') || ' ' || coalesce(j.pitch,'') || ' ' ||
             coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')
           )) AS haystack,
           lower(public.unaccent(
             coalesce(j.title,'') || ' ' || coalesce(j.occupation,'') || ' ' ||
             coalesce(j.location,'') || ' ' || coalesce(j.workplace_city,'') || ' ' ||
             coalesce(j.workplace_name,'') || ' ' ||
             coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')
           )) AS strong
    FROM public.job_postings j
    LEFT JOIN public.profiles p ON p.id = j.employer_id
    WHERE j.deleted_at IS NULL
      AND (
        j.employer_id = v_uid
        OR (v_org IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.profiles op
          WHERE op.id = j.employer_id AND op.organization_id = v_org
        ))
      )
      AND (p_recruiter_id IS NULL OR j.employer_id = p_recruiter_id)
      AND (
        p_status = 'all'
        OR (p_status = 'active' AND j.is_active = true
            AND NOT (j.published_at IS NOT NULL AND j.expires_at IS NOT NULL AND j.expires_at < now()))
        OR (p_status = 'expired' AND j.published_at IS NOT NULL AND j.expires_at IS NOT NULL AND j.expires_at < now())
        OR (p_status = 'draft' AND j.is_active IS DISTINCT FROM true
            AND NOT (j.published_at IS NOT NULL AND j.expires_at IS NOT NULL AND j.expires_at < now()))
      )
  ),
  scored AS (
    SELECT s.id,
           CASE
             WHEN v_norm = '' THEN 0::real
             ELSE (
               CASE WHEN s.strong LIKE '%' || v_norm || '%' THEN 3.0 ELSE 0 END
               + CASE WHEN s.haystack LIKE '%' || v_norm || '%' THEN 1.0 ELSE 0 END
               + public.word_similarity(v_norm, s.strong) * 2.0
               + public.word_similarity(v_norm, s.haystack)
             )::real
           END AS score
    FROM scoped s
  ),
  matched AS (
    SELECT sc.id, sc.score
    FROM scored sc
    WHERE v_norm = '' OR sc.score > 0.45
  ),
  counted AS (SELECT count(*) AS c FROM matched)
  SELECT m.id, (SELECT c FROM counted), m.score
  FROM matched m
  JOIN scoped s ON s.id = m.id
  ORDER BY
    CASE WHEN v_norm <> '' AND p_sort = 'newest' THEN m.score END DESC NULLS LAST,
    CASE WHEN p_sort = 'oldest' THEN s.created_at END ASC,
    CASE WHEN p_sort = 'title-asc' THEN s.title END ASC,
    CASE WHEN p_sort = 'title-desc' THEN s.title END DESC,
    s.created_at DESC
  LIMIT greatest(p_limit, 1) OFFSET greatest(p_offset, 0);
END;
$function$;