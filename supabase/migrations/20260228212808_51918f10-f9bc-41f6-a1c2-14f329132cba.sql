
-- Update the search_vector trigger to include custom_answers text and cover_letter
-- This makes the GIN-indexed FTS search cover ALL candidate data

CREATE OR REPLACE FUNCTION public.job_applications_generate_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_answers_text text := '';
BEGIN
  -- Extract text from custom_answers JSON for full-text indexing
  IF NEW.custom_answers IS NOT NULL THEN
    BEGIN
      -- Handle array format: [{"question":"...", "answer":"..."}]
      IF jsonb_typeof(NEW.custom_answers::jsonb) = 'array' THEN
        SELECT string_agg(
          COALESCE(elem->>'answer', '') || ' ' || COALESCE(elem->>'question', ''),
          ' '
        ) INTO v_answers_text
        FROM jsonb_array_elements(NEW.custom_answers::jsonb) AS elem;
      -- Handle object format: {"key": "value"}
      ELSIF jsonb_typeof(NEW.custom_answers::jsonb) = 'object' THEN
        SELECT string_agg(value::text, ' ') INTO v_answers_text
        FROM jsonb_each_text(NEW.custom_answers::jsonb);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_answers_text := '';
    END;
  END IF;

  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.first_name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.last_name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.email, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.phone, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.bio, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.location, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.cover_letter, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(v_answers_text, '')), 'D') ||
    setweight(to_tsvector('simple', COALESCE(NEW.availability, '')), 'D') ||
    setweight(to_tsvector('simple', COALESCE(NEW.employment_status, '')), 'D') ||
    setweight(to_tsvector('simple', COALESCE(NEW.work_schedule, '')), 'D');
  RETURN NEW;
END;
$function$;

-- Create or replace the trigger on job_applications
DROP TRIGGER IF EXISTS job_applications_search_vector_trigger ON public.job_applications;
CREATE TRIGGER job_applications_search_vector_trigger
  BEFORE INSERT OR UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.job_applications_generate_search_vector();

-- Also update the search_my_candidates function to sanitize FTS queries
-- preventing crashes on special characters like &, |, :, !, etc.
CREATE OR REPLACE FUNCTION public.search_my_candidates(p_recruiter_id uuid, p_search_query text, p_limit integer DEFAULT 50, p_cursor_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(my_candidate_id uuid, application_id uuid, applicant_id uuid, job_id uuid, stage text, notes text, rating integer, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tsquery tsquery;
  v_sanitized text;
BEGIN
  -- Prevent parameter spoofing: caller must be the recruiter
  IF auth.uid() IS NULL OR auth.uid() <> p_recruiter_id THEN
    RETURN;
  END IF;

  -- Sanitize: strip all tsquery-special characters to prevent syntax errors
  v_sanitized := regexp_replace(trim(p_search_query), '[&|!:*()''<>\\\-]', '', 'g');

  -- Convert search query to tsquery with prefix matching
  v_tsquery := to_tsquery('simple', 
    array_to_string(
      array(
        SELECT word || ':*' 
        FROM unnest(string_to_array(v_sanitized, ' ')) AS word 
        WHERE word <> ''
      ), 
      ' & '
    )
  );

  RETURN QUERY
  SELECT 
    mc.id as my_candidate_id,
    mc.application_id,
    mc.applicant_id,
    mc.job_id,
    mc.stage,
    mc.notes,
    mc.rating,
    mc.created_at,
    mc.updated_at
  FROM my_candidates mc
  JOIN job_applications ja ON ja.id = mc.application_id
  WHERE mc.recruiter_id = p_recruiter_id
    AND ja.search_vector @@ v_tsquery
    AND (p_cursor_updated_at IS NULL OR mc.updated_at < p_cursor_updated_at)
  ORDER BY mc.updated_at DESC
  LIMIT p_limit;
END;
$function$;

-- Backfill existing rows: touch all applications to regenerate search_vector
-- This runs in background and updates the vector for all existing data
UPDATE public.job_applications SET updated_at = updated_at WHERE search_vector IS NOT NULL OR search_vector IS NULL;
