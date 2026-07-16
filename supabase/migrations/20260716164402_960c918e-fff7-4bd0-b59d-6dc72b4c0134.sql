
-- Drop both existing overloads so we can extend the RETURNS TABLE
DROP FUNCTION IF EXISTS public.search_jobs(text, text, text, text[], text, integer, integer, integer, integer, timestamp with time zone);
DROP FUNCTION IF EXISTS public.search_jobs(text, text, text, text[], text, integer, integer, integer, integer, timestamp with time zone, uuid[], timestamp with time zone);

CREATE OR REPLACE FUNCTION public.search_jobs(
  p_search_query text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_county text DEFAULT NULL,
  p_employment_types text[] DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_salary_min integer DEFAULT NULL,
  p_salary_max integer DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_cursor_created_at timestamp with time zone DEFAULT NULL,
  p_employer_ids uuid[] DEFAULT NULL,
  p_created_after timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  id uuid, title text, description text, location text,
  workplace_city text, workplace_county text, workplace_municipality text,
  workplace_address text, workplace_name text, workplace_postal_code text,
  employment_type text, work_schedule text,
  salary_min integer, salary_max integer, salary_type text, salary_transparency text,
  positions_count integer, occupation text, category text, pitch text, requirements text,
  benefits text[], remote_work_possible text, work_location_type text,
  contact_email text, application_instructions text,
  job_image_url text, job_image_desktop_url text,
  employer_id uuid, company_logo_url text, overlay_text_color text,
  is_active boolean, views_count integer, applications_count integer,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  image_updated_at timestamp with time zone,
  expires_at timestamp with time zone,
  search_rank real, image_focus_position text,
  duration_amount integer, duration_unit text, part_time_days text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_terms text[];
  v_and_tsquery tsquery;
  v_or_tsquery tsquery;
  v_clean_query text;
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

  RETURN QUERY
  SELECT
    jp.id, jp.title, jp.description, jp.location,
    jp.workplace_city, jp.workplace_county, jp.workplace_municipality,
    jp.workplace_address, jp.workplace_name, jp.workplace_postal_code,
    jp.employment_type, jp.work_schedule,
    jp.salary_min, jp.salary_max, jp.salary_type, jp.salary_transparency,
    jp.positions_count, jp.occupation, jp.category, jp.pitch, jp.requirements,
    jp.benefits, jp.remote_work_possible, jp.work_location_type,
    jp.contact_email, jp.application_instructions,
    jp.job_image_url, jp.job_image_desktop_url,
    jp.employer_id, jp.company_logo_url, jp.overlay_text_color,
    jp.is_active, jp.views_count, jp.applications_count,
    jp.created_at, jp.updated_at, jp.image_updated_at, jp.expires_at,
    CASE
      WHEN v_clean_query IS NULL THEN 0.0
      ELSE GREATEST(
        CASE WHEN v_and_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_and_tsquery) ELSE 0 END,
        CASE WHEN v_or_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_or_tsquery) * 0.85 ELSE 0 END,
        CASE WHEN jp.title ILIKE '%' || v_clean_query || '%' THEN 0.75 ELSE 0 END,
        CASE WHEN jp.occupation ILIKE '%' || v_clean_query || '%' THEN 0.70 ELSE 0 END,
        CASE WHEN jp.workplace_name ILIKE '%' || v_clean_query || '%' THEN 0.45 ELSE 0 END,
        CASE WHEN jp.description ILIKE '%' || v_clean_query || '%' THEN 0.35 ELSE 0 END
      )
    END::real AS search_rank,
    jp.image_focus_position,
    jp.duration_amount, jp.duration_unit, jp.part_time_days
  FROM public.job_postings jp
  WHERE
    jp.is_active = true
    AND jp.deleted_at IS NULL
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
    AND (p_cursor_created_at IS NULL OR jp.created_at < p_cursor_created_at)
  ORDER BY
    CASE
      WHEN v_clean_query IS NULL THEN 0.0
      ELSE GREATEST(
        CASE WHEN v_and_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_and_tsquery) ELSE 0 END,
        CASE WHEN v_or_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_or_tsquery) * 0.85 ELSE 0 END,
        CASE WHEN jp.title ILIKE '%' || v_clean_query || '%' THEN 0.75 ELSE 0 END,
        CASE WHEN jp.occupation ILIKE '%' || v_clean_query || '%' THEN 0.70 ELSE 0 END,
        CASE WHEN jp.workplace_name ILIKE '%' || v_clean_query || '%' THEN 0.45 ELSE 0 END,
        CASE WHEN jp.description ILIKE '%' || v_clean_query || '%' THEN 0.35 ELSE 0 END
      )
    END DESC,
    jp.created_at DESC
  LIMIT p_limit
  OFFSET CASE WHEN p_cursor_created_at IS NULL THEN p_offset ELSE 0 END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_jobs(text, text, text, text[], text, integer, integer, integer, integer, timestamp with time zone, uuid[], timestamp with time zone) TO authenticated, anon, service_role;
