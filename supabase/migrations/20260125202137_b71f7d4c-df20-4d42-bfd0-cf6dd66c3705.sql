-- Upgrade search_jobs to include category and salary filtering at database level
-- Also add cursor-based pagination support

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.search_jobs(text, text, text, text[], integer, integer);
DROP FUNCTION IF EXISTS public.count_search_jobs(text, text, text, text[]);

-- Create improved search_jobs function with all filters at database level
CREATE OR REPLACE FUNCTION public.search_jobs(
  p_search_query text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_county text DEFAULT NULL,
  p_employment_types text[] DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_salary_min integer DEFAULT NULL,
  p_salary_max integer DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_cursor_created_at timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  location text,
  workplace_city text,
  workplace_county text,
  workplace_municipality text,
  workplace_address text,
  workplace_name text,
  workplace_postal_code text,
  employment_type text,
  work_schedule text,
  salary_min integer,
  salary_max integer,
  salary_type text,
  salary_transparency text,
  positions_count integer,
  occupation text,
  category text,
  pitch text,
  requirements text,
  benefits text[],
  remote_work_possible text,
  work_location_type text,
  contact_email text,
  application_instructions text,
  job_image_url text,
  job_image_desktop_url text,
  employer_id uuid,
  is_active boolean,
  views_count integer,
  applications_count integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  expires_at timestamp with time zone,
  search_rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  -- Build tsquery from search terms with prefix matching
  IF p_search_query IS NOT NULL AND p_search_query <> '' THEN
    v_tsquery := to_tsquery('simple', 
      array_to_string(
        array(
          SELECT word || ':*' 
          FROM unnest(string_to_array(trim(p_search_query), ' ')) AS word 
          WHERE word <> ''
        ), 
        ' & '
      )
    );
  END IF;

  RETURN QUERY
  SELECT 
    jp.id,
    jp.title,
    jp.description,
    jp.location,
    jp.workplace_city,
    jp.workplace_county,
    jp.workplace_municipality,
    jp.workplace_address,
    jp.workplace_name,
    jp.workplace_postal_code,
    jp.employment_type,
    jp.work_schedule,
    jp.salary_min,
    jp.salary_max,
    jp.salary_type,
    jp.salary_transparency,
    jp.positions_count,
    jp.occupation,
    jp.category,
    jp.pitch,
    jp.requirements,
    jp.benefits,
    jp.remote_work_possible,
    jp.work_location_type,
    jp.contact_email,
    jp.application_instructions,
    jp.job_image_url,
    jp.job_image_desktop_url,
    jp.employer_id,
    jp.is_active,
    jp.views_count,
    jp.applications_count,
    jp.created_at,
    jp.updated_at,
    jp.expires_at,
    CASE 
      WHEN v_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_tsquery)
      ELSE 0.0
    END::real as search_rank
  FROM public.job_postings jp
  WHERE 
    jp.is_active = true
    AND jp.deleted_at IS NULL
    -- Full-text search (uses GIN index)
    AND (v_tsquery IS NULL OR jp.search_vector @@ v_tsquery)
    -- Location filters (uses B-tree indexes)
    AND (p_city IS NULL OR p_city = '' OR 
         jp.workplace_city ILIKE '%' || p_city || '%' OR
         jp.workplace_municipality ILIKE '%' || p_city || '%' OR
         jp.location ILIKE '%' || p_city || '%')
    AND (p_county IS NULL OR p_county = '' OR jp.workplace_county = p_county)
    -- Employment type filter
    AND (p_employment_types IS NULL OR array_length(p_employment_types, 1) IS NULL OR 
         jp.employment_type = ANY(p_employment_types))
    -- Category filter (NEW - at database level)
    AND (p_category IS NULL OR p_category = '' OR jp.category = p_category)
    -- Salary filter (NEW - at database level)
    AND (p_salary_min IS NULL OR jp.salary_max >= p_salary_min OR jp.salary_max IS NULL)
    AND (p_salary_max IS NULL OR jp.salary_min <= p_salary_max OR jp.salary_min IS NULL)
    -- Cursor-based pagination (NEW)
    AND (p_cursor_created_at IS NULL OR jp.created_at < p_cursor_created_at)
  ORDER BY 
    CASE WHEN v_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_tsquery) ELSE 0 END DESC,
    jp.created_at DESC
  LIMIT p_limit
  OFFSET CASE WHEN p_cursor_created_at IS NULL THEN p_offset ELSE 0 END;
END;
$$;

-- Create improved count function with all filters
CREATE OR REPLACE FUNCTION public.count_search_jobs(
  p_search_query text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_county text DEFAULT NULL,
  p_employment_types text[] DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_salary_min integer DEFAULT NULL,
  p_salary_max integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsquery tsquery;
  v_count integer;
BEGIN
  IF p_search_query IS NOT NULL AND p_search_query <> '' THEN
    v_tsquery := to_tsquery('simple', 
      array_to_string(
        array(
          SELECT word || ':*' 
          FROM unnest(string_to_array(trim(p_search_query), ' ')) AS word 
          WHERE word <> ''
        ), 
        ' & '
      )
    );
  END IF;

  SELECT COUNT(*)::integer INTO v_count
  FROM public.job_postings jp
  WHERE 
    jp.is_active = true
    AND jp.deleted_at IS NULL
    AND (v_tsquery IS NULL OR jp.search_vector @@ v_tsquery)
    AND (p_city IS NULL OR p_city = '' OR 
         jp.workplace_city ILIKE '%' || p_city || '%' OR
         jp.workplace_municipality ILIKE '%' || p_city || '%' OR
         jp.location ILIKE '%' || p_city || '%')
    AND (p_county IS NULL OR p_county = '' OR jp.workplace_county = p_county)
    AND (p_employment_types IS NULL OR array_length(p_employment_types, 1) IS NULL OR 
         jp.employment_type = ANY(p_employment_types))
    AND (p_category IS NULL OR p_category = '' OR jp.category = p_category)
    AND (p_salary_min IS NULL OR jp.salary_max >= p_salary_min OR jp.salary_max IS NULL)
    AND (p_salary_max IS NULL OR jp.salary_min <= p_salary_max OR jp.salary_min IS NULL);

  RETURN v_count;
END;
$$;

-- Add index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_job_postings_category ON public.job_postings(category) WHERE is_active = true AND deleted_at IS NULL;

-- Add index for salary range queries
CREATE INDEX IF NOT EXISTS idx_job_postings_salary_range ON public.job_postings(salary_min, salary_max) WHERE is_active = true AND deleted_at IS NULL;