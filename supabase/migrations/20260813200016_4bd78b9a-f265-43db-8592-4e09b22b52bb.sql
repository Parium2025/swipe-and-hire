CREATE OR REPLACE FUNCTION public.search_employer_candidates(
  p_search text DEFAULT NULL::text,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_status text DEFAULT NULL::text,
  p_sort text DEFAULT 'applied_at'::text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_with_count boolean DEFAULT true
)
RETURNS TABLE(id uuid, job_id uuid, applicant_id uuid, first_name text, last_name text, email text, phone text, location text, bio text, cv_url text, age integer, employment_status text, work_schedule text, availability text, custom_answers jsonb, questions_snapshot jsonb, status text, applied_at timestamp with time zone, updated_at timestamp with time zone, viewed_at timestamp with time zone, job_title text, job_occupation text, rating integer, total_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_filters jsonb := coalesce(p_filters, '[]'::jsonb);
  v_sort text := coalesce(p_sort, 'applied_at');
  v_limit integer := least(coalesce(p_limit, 25), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_with_count boolean := coalesce(p_with_count, true);
  v_org uuid;
  v_tsquery text;
  v_norm text;
  v_tokens text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT ur.organization_id INTO v_org
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid AND ur.is_active = true AND ur.organization_id IS NOT NULL
  LIMIT 1;

  IF v_search IS NOT NULL THEN
    SELECT string_agg(t || ':*', ' & ')
    INTO v_tsquery
    FROM regexp_split_to_table(regexp_replace(lower(v_search), '[^a-z0-9åäöéèü ]', ' ', 'g'), '\s+') AS t
    WHERE btrim(t) <> '';

    v_norm := public.parium_norm(v_search);
    SELECT array_agg(t) INTO v_tokens
    FROM regexp_split_to_table(v_norm, '\s+') AS t
    WHERE btrim(t) <> '';
  END IF;

  RETURN QUERY
  WITH my_jobs AS (
    SELECT j.id, j.title, j.occupation
    FROM public.job_postings j
    WHERE j.employer_id = v_uid
       OR (
         v_org IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = j.employer_id
             AND ur.is_active = true
             AND ur.organization_id = v_org
         )
       )
  ),
  base AS (
    SELECT DISTINCT ON (a.applicant_id)
      a.id, a.job_id, a.applicant_id, a.first_name, a.last_name, a.email, a.phone,
      a.location, a.bio, a.cv_url, a.age, a.employment_status, a.work_schedule,
      a.availability, a.custom_answers, a.questions_snapshot, a.status,
      a.applied_at, a.updated_at, a.viewed_at,
      j.title AS job_title, j.occupation AS job_occupation,
      CASE
        WHEN v_norm IS NULL THEN 0::real
        ELSE greatest(
          similarity(public.parium_norm(coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')), v_norm),
          similarity(public.parium_norm(coalesce(a.last_name,'') || ' ' || coalesce(a.first_name,'')), v_norm)
        )
      END AS name_score
    FROM public.job_applications a
    JOIN my_jobs j ON j.id = a.job_id
    WHERE (p_status IS NULL OR a.status = p_status)
      AND (
        v_search IS NULL
        OR (v_tsquery IS NOT NULL AND a.search_vector @@ to_tsquery('simple', v_tsquery))
        OR public.parium_norm(coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')) % v_norm
        OR public.parium_norm(coalesce(a.last_name,'') || ' ' || coalesce(a.first_name,'')) % v_norm
        OR (
          v_tokens IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM unnest(v_tokens) AS tok
            WHERE NOT (
              public.parium_norm(
                coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'') || ' ' ||
                coalesce(a.email,'') || ' ' || coalesce(a.phone,'') || ' ' ||
                coalesce(a.location,'') || ' ' || coalesce(j.title,'') || ' ' ||
                coalesce(j.occupation,'')
              ) LIKE '%' || tok || '%'
              OR (
                length(tok) >= 4
                AND word_similarity(tok, public.parium_norm(
                  coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'') || ' ' ||
                  coalesce(a.location,'') || ' ' || coalesce(j.title,'')
                )) >= 0.45
              )
            )
          )
        )
      )
      AND (
        jsonb_array_length(v_filters) = 0
        OR NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(v_filters) AS f
          WHERE NOT EXISTS (
            SELECT 1
            FROM jsonb_each_text(coalesce(a.custom_answers, '{}'::jsonb)) AS kv(k, v)
            WHERE lower(btrim(kv.k)) = lower(btrim(f->>'question'))
              AND coalesce(btrim(kv.v), '') <> ''
              AND (
                jsonb_array_length(coalesce(f->'answers', '[]'::jsonb)) = 0
                OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements_text(f->'answers') AS ans
                  WHERE lower(btrim(ans)) = lower(btrim(kv.v))
                     OR (lower(btrim(kv.v)) = 'true' AND lower(btrim(ans)) = 'ja')
                     OR (lower(btrim(kv.v)) = 'false' AND lower(btrim(ans)) = 'nej')
                )
              )
          )
        )
      )
    ORDER BY a.applicant_id, a.applied_at DESC
  ),
  scored AS (
    SELECT b.*, r.rating::integer AS rating
    FROM base b
    LEFT JOIN public.candidate_ratings r
      ON r.applicant_id = b.applicant_id
     AND r.recruiter_id = v_uid
  )
  SELECT
    s.id, s.job_id, s.applicant_id, s.first_name, s.last_name, s.email, s.phone,
    s.location, s.bio, s.cv_url, s.age, s.employment_status, s.work_schedule,
    s.availability, s.custom_answers, s.questions_snapshot, s.status,
    s.applied_at, s.updated_at, s.viewed_at, s.job_title, s.job_occupation,
    s.rating,
    CASE WHEN v_with_count THEN count(*) OVER () ELSE NULL::bigint END AS total_count
  FROM scored s
  ORDER BY
    CASE WHEN v_sort = 'rating' THEN s.rating END DESC NULLS LAST,
    CASE WHEN v_sort = 'name' THEN lower(coalesce(s.first_name,'') || ' ' || coalesce(s.last_name,'')) END ASC,
    CASE WHEN v_sort = 'oldest' THEN s.applied_at END ASC,
    CASE WHEN v_search IS NOT NULL AND v_sort NOT IN ('rating','name','oldest') THEN s.name_score END DESC NULLS LAST,
    s.applied_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_employer_candidates(text, jsonb, text, text, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_employer_candidates(text, jsonb, text, text, integer, integer, boolean) TO authenticated;