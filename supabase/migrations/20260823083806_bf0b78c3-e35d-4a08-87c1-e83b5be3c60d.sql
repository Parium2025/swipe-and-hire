-- 1. Keyset-index per kolumn (steg) — konstant svarstid även vid tusentals rader
CREATE INDEX IF NOT EXISTS idx_my_candidates_recruiter_list_stage_updated
  ON public.my_candidates (recruiter_id, list_id, stage, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_my_candidates_recruiter_stage_updated
  ON public.my_candidates (recruiter_id, stage, updated_at DESC);

-- 2. Sanna antal per steg i ETT anrop
CREATE OR REPLACE FUNCTION public.count_my_candidates_per_stage(p_list_id uuid DEFAULT NULL)
RETURNS TABLE(stage text, candidate_count bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT mc.stage, count(DISTINCT mc.applicant_id) AS candidate_count
  FROM public.my_candidates mc
  WHERE mc.recruiter_id = auth.uid()
    AND (p_list_id IS NULL OR mc.list_id = p_list_id)
  GROUP BY mc.stage
$function$;

GRANT EXECUTE ON FUNCTION public.count_my_candidates_per_stage(uuid) TO authenticated;

-- 3. Sök per steg — ersätter de äldre varianterna så att signaturen blir entydig
DROP FUNCTION IF EXISTS public.search_my_candidates(uuid, text, integer, timestamptz);
DROP FUNCTION IF EXISTS public.search_my_candidates(uuid, text, integer, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.search_my_candidates(
  p_recruiter_id uuid,
  p_search_query text,
  p_limit integer DEFAULT 50,
  p_cursor_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_list_id uuid DEFAULT NULL::uuid,
  p_stage text DEFAULT NULL::text
)
RETURNS TABLE(
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
AS $function$
DECLARE
  v_tsquery tsquery;
  v_sanitized text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_recruiter_id THEN
    RETURN;
  END IF;

  v_sanitized := regexp_replace(trim(p_search_query), '[&|!:*()''<>\\\-]', '', 'g');

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
    AND (p_list_id IS NULL OR mc.list_id = p_list_id)
    AND (p_stage IS NULL OR mc.stage = p_stage)
    AND ja.search_vector @@ v_tsquery
    AND (p_cursor_updated_at IS NULL OR mc.updated_at < p_cursor_updated_at)
  ORDER BY mc.updated_at DESC
  LIMIT p_limit;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_my_candidates(uuid, text, integer, timestamptz, uuid, text) TO authenticated;