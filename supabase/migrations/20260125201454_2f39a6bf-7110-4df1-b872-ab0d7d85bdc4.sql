-- =====================================================
-- JOB SEARCH OPTIMIZATION FOR 100,000+ JOBS
-- Full-text search with tsvector and optimized indexes
-- =====================================================

-- 1. Add search_vector column for full-text search
ALTER TABLE public.job_postings 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Create function to generate search vector with Swedish config
CREATE OR REPLACE FUNCTION public.job_postings_generate_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_city, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_municipality, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_county, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.occupation, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.requirements, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.pitch, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_name, '')), 'D') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_address, '')), 'D');
  RETURN NEW;
END;
$$;

-- 3. Create trigger to auto-update search_vector
DROP TRIGGER IF EXISTS job_postings_search_vector_trigger ON public.job_postings;
CREATE TRIGGER job_postings_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description, requirements, pitch, occupation, category, 
    workplace_city, workplace_municipality, workplace_county, workplace_name, workplace_address
  ON public.job_postings
  FOR EACH ROW
  EXECUTE FUNCTION public.job_postings_generate_search_vector();

-- 4. Populate search_vector for existing jobs
UPDATE public.job_postings SET search_vector = 
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE(workplace_city, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(workplace_municipality, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(workplace_county, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(occupation, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(category, '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE(requirements, '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE(pitch, '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE(workplace_name, '')), 'D') ||
  setweight(to_tsvector('simple', COALESCE(workplace_address, '')), 'D')
WHERE search_vector IS NULL;

-- 5. Create GIN index for full-text search (10-100x faster than ILIKE)
CREATE INDEX IF NOT EXISTS idx_job_postings_search_vector 
ON public.job_postings USING GIN (search_vector);

-- 6. Create B-tree indexes for filter columns
CREATE INDEX IF NOT EXISTS idx_job_postings_is_active 
ON public.job_postings (is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_job_postings_workplace_city 
ON public.job_postings (workplace_city);

CREATE INDEX IF NOT EXISTS idx_job_postings_workplace_county 
ON public.job_postings (workplace_county);

CREATE INDEX IF NOT EXISTS idx_job_postings_workplace_municipality 
ON public.job_postings (workplace_municipality);

CREATE INDEX IF NOT EXISTS idx_job_postings_employment_type 
ON public.job_postings (employment_type);

CREATE INDEX IF NOT EXISTS idx_job_postings_expires_at 
ON public.job_postings (expires_at);

CREATE INDEX IF NOT EXISTS idx_job_postings_created_at 
ON public.job_postings (created_at DESC);

-- 7. Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_job_postings_active_city_created 
ON public.job_postings (is_active, workplace_city, created_at DESC) 
WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_postings_active_county_created 
ON public.job_postings (is_active, workplace_county, created_at DESC) 
WHERE is_active = true AND deleted_at IS NULL;

-- 8. Create optimized search function for high-performance queries
CREATE OR REPLACE FUNCTION public.search_jobs(
  p_search_query text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_county text DEFAULT NULL,
  p_employment_types text[] DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
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
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz,
  search_rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
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
  ORDER BY 
    CASE WHEN v_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_tsquery) ELSE 0 END DESC,
    jp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 9. Create function to count total results (for pagination)
CREATE OR REPLACE FUNCTION public.count_search_jobs(
  p_search_query text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_county text DEFAULT NULL,
  p_employment_types text[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
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
         jp.employment_type = ANY(p_employment_types));

  RETURN v_count;
END;
$$;