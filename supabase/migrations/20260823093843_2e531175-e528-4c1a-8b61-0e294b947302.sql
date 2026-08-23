DROP FUNCTION IF EXISTS public.search_my_candidates(uuid, text, integer, timestamptz, uuid, text);

CREATE OR REPLACE FUNCTION public.search_my_candidates(
  p_recruiter_id uuid,
  p_search_query text,
  p_limit integer DEFAULT 50,
  p_cursor_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id uuid DEFAULT NULL::uuid,
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

  v_sanitized := regexp_replace(trim(p_search_query), '[&|!:*()''<>\-]', '', 'g');

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
  FROM public.my_candidates mc
  JOIN public.job_applications ja ON ja.id = mc.application_id
  WHERE mc.recruiter_id = p_recruiter_id
    AND (p_list_id IS NULL OR mc.list_id = p_list_id)
    AND (p_stage IS NULL OR mc.stage = p_stage)
    AND ja.search_vector @@ v_tsquery
    AND (
      p_cursor_updated_at IS NULL
      OR mc.updated_at < p_cursor_updated_at
      OR (mc.updated_at = p_cursor_updated_at AND mc.id < p_cursor_id)
    )
  ORDER BY mc.updated_at DESC, mc.id DESC
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_my_candidates(uuid, text, integer, timestamptz, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_my_candidates(uuid, text, integer, timestamptz, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_my_candidates(uuid, text, integer, timestamptz, uuid, uuid, text) TO service_role;