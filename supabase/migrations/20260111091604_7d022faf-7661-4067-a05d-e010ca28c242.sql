-- Create RPC function for Full-Text Search on My Candidates
-- This searches through job_applications linked to the recruiter's my_candidates entries
-- Uses the GIN-indexed search_vector for blazing fast performance on 100k+ candidates

CREATE OR REPLACE FUNCTION public.search_my_candidates(
  p_recruiter_id uuid,
  p_search_query text,
  p_limit integer DEFAULT 50,
  p_cursor_updated_at timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  my_candidate_id uuid,
  application_id uuid,
  applicant_id uuid,
  job_id uuid,
  stage text,
  notes text,
  rating integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  -- Prevent parameter spoofing: caller must be the recruiter
  IF auth.uid() IS NULL OR auth.uid() <> p_recruiter_id THEN
    RETURN;
  END IF;

  -- Convert search query to tsquery with prefix matching
  -- "Johan Svensson" becomes "Johan:* & Svensson:*"
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
$$;

-- Add index on my_candidates for faster recruiter lookups
CREATE INDEX IF NOT EXISTS idx_my_candidates_recruiter_id ON public.my_candidates(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_my_candidates_updated_at ON public.my_candidates(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_my_candidates_application_id ON public.my_candidates(application_id);

COMMENT ON FUNCTION public.search_my_candidates IS 'Full-Text Search on My Candidates - uses GIN-indexed search_vector for 10-100x faster search on large datasets';