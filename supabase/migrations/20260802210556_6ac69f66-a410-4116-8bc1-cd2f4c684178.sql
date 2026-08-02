
CREATE OR REPLACE FUNCTION public.requeue_missing_cv_analyses(p_limit integer DEFAULT 25)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  UPDATE cv_analysis_queue
  SET status = 'pending', attempts = 0, started_at = NULL, completed_at = NULL, updated_at = now()
  WHERE status = 'failed'
    AND updated_at < now() - interval '30 minutes'
    AND created_at > now() - interval '7 days';

  WITH candidates AS (
    SELECT p.user_id AS applicant_id, p.cv_url
    FROM profiles p
    LEFT JOIN profile_cv_summaries s
      ON s.user_id = p.user_id AND s.cv_url = p.cv_url AND coalesce(s.summary_text, '') <> ''
    WHERE p.user_id IS NOT NULL
      AND p.cv_url IS NOT NULL
      AND p.cv_url <> ''
      AND s.id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM cv_analysis_queue q
        WHERE q.applicant_id = p.user_id
          AND q.cv_url = p.cv_url
          AND (q.status IN ('pending', 'processing')
               OR q.updated_at > now() - interval '30 minutes')
      )
      -- Kostnadsspärr: max 3 automatiska försök per fil
      AND (
        SELECT count(*) FROM cv_analysis_queue q2
        WHERE q2.applicant_id = p.user_id AND q2.cv_url = p.cv_url
      ) < 3
    LIMIT p_limit
  )
  INSERT INTO cv_analysis_queue (applicant_id, cv_url, status, priority)
  SELECT applicant_id, cv_url, 'pending', -1 FROM candidates;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.requeue_missing_cv_analyses(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_missing_cv_analyses(integer) TO service_role;
