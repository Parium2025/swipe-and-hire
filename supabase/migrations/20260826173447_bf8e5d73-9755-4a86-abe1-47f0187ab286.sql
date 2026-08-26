DROP FUNCTION IF EXISTS public.search_jobs(text, text, text, text[], text, integer, integer, integer, integer, timestamptz, uuid[], timestamptz);

CREATE OR REPLACE FUNCTION public.search_jobs(
  p_search_query text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_county text DEFAULT NULL::text,
  p_employment_types text[] DEFAULT NULL::text[],
  p_category text DEFAULT NULL::text,
  p_salary_min integer DEFAULT NULL::integer,
  p_salary_max integer DEFAULT NULL::integer,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_employer_ids uuid[] DEFAULT NULL::uuid[],
  p_created_after timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_sort text DEFAULT 'newest'::text,
  p_cursor_id uuid DEFAULT NULL::uuid,
  p_cursor_rank real DEFAULT NULL::real,
  p_cursor_views integer DEFAULT NULL::integer
)
RETURNS TABLE(id uuid, title text, description text, location text, workplace_city text, workplace_county text, workplace_municipality text, workplace_address text, workplace_name text, workplace_postal_code text, employment_type text, work_schedule text, salary_min integer, salary_max integer, salary_type text, salary_transparency text, positions_count integer, occupation text, category text, pitch text, requirements text, benefits text[], remote_work_possible text, work_location_type text, contact_email text, application_instructions text, job_image_url text, job_image_desktop_url text, employer_id uuid, company_logo_url text, overlay_text_color text, is_active boolean, views_count integer, applications_count integer, created_at timestamp with time zone, updated_at timestamp with time zone, image_updated_at timestamp with time zone, expires_at timestamp with time zone, search_rank real, image_focus_position text, image_focus_position_desktop text, duration_amount integer, duration_unit text, part_time_days text[], part_time_shifts text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_terms text[];
  v_and_tsquery tsquery;
  v_or_tsquery tsquery;
  v_clean_query text;
  v_sort text;
BEGIN
  v_sort := lower(coalesce(nullif(trim(p_sort), ''), 'newest'));
  IF v_sort NOT IN ('newest', 'oldest', 'most-views') THEN
    v_sort := 'newest';
  END IF;

  v_clean_query := nullif(trim(coalesce(p_search_query, '')), '');

  IF v_clean_query IS NOT NULL THEN
    SELECT array_agg(word)
    INTO v_terms
    FROM regexp_split_to_table(
      regexp_replace(lower(v_clean_query), '[^[:alnum:]åäöéè]+', ' ', 'g'),
      '\s+'
    ) AS word
    WHERE word <> '';

    IF array_length(v_terms, 1) IS NOT NULL THEN
      v_and_tsquery := to_tsquery('simple', (
        SELECT array_to_string(array_agg(term || ':*'), ' & ')
        FROM unnest(v_terms) AS term
      ));

      v_or_tsquery := to_tsquery('simple', (
        SELECT array_to_string(array_agg(term || ':*'), ' | ')
        FROM unnest(v_terms) AS term
      ));
    END IF;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      jp.*,
      (CASE
        WHEN v_clean_query IS NULL THEN 0.0
        ELSE GREATEST(
          CASE WHEN v_and_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_and_tsquery) ELSE 0 END,
          CASE WHEN v_or_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_or_tsquery) * 0.85 ELSE 0 END,
          CASE WHEN jp.title ILIKE '%' || v_clean_query || '%' THEN 0.75 ELSE 0 END,
          CASE WHEN jp.occupation ILIKE '%' || v_clean_query || '%' THEN 0.70 ELSE 0 END,
          CASE WHEN jp.workplace_name ILIKE '%' || v_clean_query || '%' THEN 0.45 ELSE 0 END,
          CASE WHEN jp.description ILIKE '%' || v_clean_query || '%' THEN 0.35 ELSE 0 END
        )
      END)::real AS r
    FROM public.job_postings jp
    WHERE
      jp.is_active = true
      AND jp.deleted_at IS NULL AND (jp.expires_at IS NULL OR jp.expires_at > now())
      AND (
        v_clean_query IS NULL
        OR (v_and_tsquery IS NOT NULL AND jp.search_vector @@ v_and_tsquery)
        OR (v_or_tsquery IS NOT NULL AND jp.search_vector @@ v_or_tsquery)
        OR jp.title ILIKE '%' || v_clean_query || '%'
        OR jp.occupation ILIKE '%' || v_clean_query || '%'
        OR jp.workplace_name ILIKE '%' || v_clean_query || '%'
        OR jp.description ILIKE '%' || v_clean_query || '%'
      )
      AND (p_city IS NULL OR p_city = '' OR
           jp.workplace_city ILIKE '%' || p_city || '%' OR
           jp.workplace_municipality ILIKE '%' || p_city || '%' OR
           jp.location ILIKE '%' || p_city || '%' OR
           jp.workplace_county ILIKE '%' || p_city || '%')
      AND (p_county IS NULL OR p_county = '' OR jp.workplace_county = p_county)
      AND (p_employment_types IS NULL OR array_length(p_employment_types, 1) IS NULL OR
           jp.employment_type = ANY(p_employment_types))
      AND (p_category IS NULL OR p_category = '' OR jp.category = p_category)
      AND (p_salary_min IS NULL OR jp.salary_max >= p_salary_min OR jp.salary_max IS NULL)
      AND (p_salary_max IS NULL OR jp.salary_min <= p_salary_max OR jp.salary_min IS NULL)
      AND (p_employer_ids IS NULL OR array_length(p_employer_ids, 1) IS NULL OR jp.employer_id = ANY(p_employer_ids))
      AND (p_created_after IS NULL OR jp.created_at >= p_created_after)
  )
  SELECT
    b.id, b.title, b.description, b.location,
    b.workplace_city, b.workplace_county, b.workplace_municipality,
    b.workplace_address, b.workplace_name, b.workplace_postal_code,
    b.employment_type, b.work_schedule,
    b.salary_min, b.salary_max, b.salary_type, b.salary_transparency,
    b.positions_count, b.occupation, b.category, b.pitch, b.requirements,
    b.benefits, b.remote_work_possible, b.work_location_type,
    b.contact_email, b.application_instructions,
    b.job_image_url, b.job_image_desktop_url,
    b.employer_id, b.company_logo_url, b.overlay_text_color,
    b.is_active, b.views_count, b.applications_count,
    b.created_at, b.updated_at, b.image_updated_at, b.expires_at,
    b.r AS search_rank,
    b.image_focus_position,
    b.image_focus_position_desktop,
    b.duration_amount, b.duration_unit, b.part_time_days, b.part_time_shifts
  FROM base b
  WHERE
    CASE
      WHEN p_cursor_created_at IS NULL THEN true
      WHEN v_sort = 'oldest' THEN
        (b.created_at, b.id) > (p_cursor_created_at, coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid))
      WHEN v_sort = 'most-views' THEN
        (coalesce(b.views_count, 0), b.created_at, b.id)
          < (coalesce(p_cursor_views, 0), p_cursor_created_at, coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      ELSE
        (b.r, b.created_at, b.id)
          < (coalesce(p_cursor_rank, 0::real), p_cursor_created_at, coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    END
  ORDER BY
    CASE WHEN v_sort = 'newest' THEN b.r END DESC,
    CASE WHEN v_sort = 'most-views' THEN coalesce(b.views_count, 0) END DESC,
    CASE WHEN v_sort = 'oldest' THEN b.created_at END ASC,
    CASE WHEN v_sort <> 'oldest' THEN b.created_at END DESC,
    CASE WHEN v_sort = 'oldest' THEN b.id END ASC,
    CASE WHEN v_sort <> 'oldest' THEN b.id END DESC
  LIMIT p_limit
  OFFSET CASE WHEN p_cursor_created_at IS NULL THEN p_offset ELSE 0 END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_jobs(text, text, text, text[], text, integer, integer, integer, integer, timestamptz, uuid[], timestamptz, text, uuid, real, integer) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.count_search_jobs(text, text, text, text[], text, integer, integer);

CREATE OR REPLACE FUNCTION public.count_search_jobs(
  p_search_query text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_county text DEFAULT NULL::text,
  p_employment_types text[] DEFAULT NULL::text[],
  p_category text DEFAULT NULL::text,
  p_salary_min integer DEFAULT NULL::integer,
  p_salary_max integer DEFAULT NULL::integer,
  p_employer_ids uuid[] DEFAULT NULL::uuid[],
  p_created_after timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_terms text[];
  v_and_tsquery tsquery;
  v_or_tsquery tsquery;
  v_clean_query text;
  v_count integer;
BEGIN
  v_clean_query := nullif(trim(coalesce(p_search_query, '')), '');

  IF v_clean_query IS NOT NULL THEN
    SELECT array_agg(word)
    INTO v_terms
    FROM regexp_split_to_table(
      regexp_replace(lower(v_clean_query), '[^[:alnum:]åäöéè]+', ' ', 'g'),
      '\s+'
    ) AS word
    WHERE word <> '';

    IF array_length(v_terms, 1) IS NOT NULL THEN
      v_and_tsquery := to_tsquery('simple', (
        SELECT array_to_string(array_agg(term || ':*'), ' & ')
        FROM unnest(v_terms) AS term
      ));
      v_or_tsquery := to_tsquery('simple', (
        SELECT array_to_string(array_agg(term || ':*'), ' | ')
        FROM unnest(v_terms) AS term
      ));
    END IF;
  END IF;

  SELECT COUNT(*)::integer INTO v_count
  FROM public.job_postings jp
  WHERE
    jp.is_active = true
    AND jp.deleted_at IS NULL AND (jp.expires_at IS NULL OR jp.expires_at > now())
    AND (
      v_clean_query IS NULL
      OR (v_and_tsquery IS NOT NULL AND jp.search_vector @@ v_and_tsquery)
      OR (v_or_tsquery IS NOT NULL AND jp.search_vector @@ v_or_tsquery)
      OR jp.title ILIKE '%' || v_clean_query || '%'
      OR jp.occupation ILIKE '%' || v_clean_query || '%'
      OR jp.workplace_name ILIKE '%' || v_clean_query || '%'
      OR jp.description ILIKE '%' || v_clean_query || '%'
    )
    AND (p_city IS NULL OR p_city = '' OR
         jp.workplace_city ILIKE '%' || p_city || '%' OR
         jp.workplace_municipality ILIKE '%' || p_city || '%' OR
         jp.location ILIKE '%' || p_city || '%' OR
         jp.workplace_county ILIKE '%' || p_city || '%')
    AND (p_county IS NULL OR p_county = '' OR jp.workplace_county = p_county)
    AND (p_employment_types IS NULL OR array_length(p_employment_types, 1) IS NULL OR
         jp.employment_type = ANY(p_employment_types))
    AND (p_category IS NULL OR p_category = '' OR jp.category = p_category)
    AND (p_salary_min IS NULL OR jp.salary_max >= p_salary_min OR jp.salary_max IS NULL)
    AND (p_salary_max IS NULL OR jp.salary_min <= p_salary_max OR jp.salary_min IS NULL)
    AND (p_employer_ids IS NULL OR array_length(p_employer_ids, 1) IS NULL OR jp.employer_id = ANY(p_employer_ids))
    AND (p_created_after IS NULL OR jp.created_at >= p_created_after);

  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.count_search_jobs(text, text, text, text[], text, integer, integer, uuid[], timestamptz) TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_job_postings_active_views
  ON public.job_postings (views_count DESC, created_at DESC, id DESC)
  WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_postings_active_created_id
  ON public.job_postings (created_at DESC, id DESC)
  WHERE is_active = true AND deleted_at IS NULL;