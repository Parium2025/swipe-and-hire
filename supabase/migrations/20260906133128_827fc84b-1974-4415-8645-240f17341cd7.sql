CREATE INDEX IF NOT EXISTS idx_criterion_results_match
  ON public.criterion_results (criterion_id, evaluation_id)
  WHERE result = 'match';

CREATE OR REPLACE FUNCTION public.filter_candidates_by_criteria(
  _job_ids uuid[],
  _criterion_ids uuid[]
)
RETURNS TABLE (job_id uuid, applicant_id uuid, match_state text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _jid uuid;
  _required int := COALESCE(array_length(_criterion_ids, 1), 0);
BEGIN
  IF _job_ids IS NULL OR array_length(_job_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH _jid IN ARRAY _job_ids LOOP
    IF NOT public.can_view_job_application(_jid) THEN
      RAISE EXCEPTION 'Not authorized for job %', _jid USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT ja.job_id,
         ja.applicant_id,
         CASE
           WHEN ce.id IS NULL OR ce.status <> 'completed' THEN 'pending'
           ELSE 'match'
         END AS match_state
  FROM public.job_applications ja
  LEFT JOIN public.candidate_evaluations ce
    ON ce.job_id = ja.job_id
   AND ce.applicant_id = ja.applicant_id
  WHERE ja.job_id = ANY(_job_ids)
    AND (
      _required = 0
      OR ce.id IS NULL
      OR ce.status <> 'completed'
      OR (
        SELECT count(DISTINCT cr.criterion_id)
        FROM public.criterion_results cr
        WHERE cr.evaluation_id = ce.id
          AND cr.criterion_id = ANY(_criterion_ids)
          AND cr.result = 'match'
      ) = _required
    );
END;
$$;

REVOKE ALL ON FUNCTION public.filter_candidates_by_criteria(uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.filter_candidates_by_criteria(uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.filter_candidates_by_criteria(uuid[], uuid[]) TO service_role;