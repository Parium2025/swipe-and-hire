CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_job_applications_custom_answers
  ON public.job_applications USING gin (custom_answers jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_job_applications_name_trgm
  ON public.job_applications USING gin (
    (coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops
  );

CREATE OR REPLACE FUNCTION public.search_employer_candidates(
  p_search text DEFAULT NULL,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_status text DEFAULT NULL,
  p_sort text DEFAULT 'applied_at',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  applicant_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  location text,
  bio text,
  cv_url text,
  age integer,
  employment_status text,
  work_schedule text,
  availability text,
  custom_answers jsonb,
  questions_snapshot jsonb,
  status text,
  applied_at timestamptz,
  updated_at timestamptz,
  viewed_at timestamptz,
  job_title text,
  job_occupation text,
  rating integer,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_clean text;
  v_tsquery text;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_filters jsonb := coalesce(p_filters, '[]'::jsonb);
  v_sort text := coalesce(p_sort, 'applied_at');
BEGIN
  IF v_search IS NOT NULL THEN
    v_clean := btrim(regexp_replace(lower(v_search), '[^a-z0-9åäöéèüïñ ]', ' ', 'g'));
    v_clean := regexp_replace(v_clean, '\s+', ' ', 'g');
    SELECT string_agg(w || ':*', ' & ')
      INTO v_tsquery
      FROM regexp_split_to_table(coalesce(v_clean, ''), ' ') AS w
     WHERE length(w) > 0;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT DISTINCT ON (a.applicant_id)
      a.id,
      a.job_id,
      a.applicant_id,
      a.first_name,
      a.last_name,
      a.email,
      a.phone,
      a.location,
      a.bio,
      a.cv_url,
      a.age,
      a.employment_status,
      a.work_schedule,
      a.availability,
      a.custom_answers,
      a.questions_snapshot,
      a.status,
      a.applied_at,
      a.updated_at,
      a.viewed_at,
      j.title AS job_title,
      j.occupation AS job_occupation
    FROM public.job_applications a
    JOIN public.job_postings j ON j.id = a.job_id
    WHERE (p_status IS NULL OR a.status = p_status)
      AND (
        v_search IS NULL
        OR (v_tsquery IS NOT NULL AND a.search_vector @@ to_tsquery('simple', v_tsquery))
        OR j.title ILIKE '%' || v_search || '%'
        OR j.occupation ILIKE '%' || v_search || '%'
        OR (coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')) % v_search
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
     AND r.recruiter_id = auth.uid()
  )
  SELECT
    s.id, s.job_id, s.applicant_id, s.first_name, s.last_name, s.email, s.phone,
    s.location, s.bio, s.cv_url, s.age, s.employment_status, s.work_schedule,
    s.availability, s.custom_answers, s.questions_snapshot, s.status,
    s.applied_at, s.updated_at, s.viewed_at, s.job_title, s.job_occupation,
    s.rating,
    count(*) OVER () AS total_count
  FROM scored s
  ORDER BY
    CASE WHEN v_sort = 'rating' THEN s.rating END DESC NULLS LAST,
    CASE WHEN v_sort = 'name' THEN lower(coalesce(s.first_name,'') || ' ' || coalesce(s.last_name,'')) END ASC,
    CASE WHEN v_sort = 'oldest' THEN s.applied_at END ASC,
    s.applied_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_employer_candidates(text, jsonb, text, text, integer, integer) TO authenticated;