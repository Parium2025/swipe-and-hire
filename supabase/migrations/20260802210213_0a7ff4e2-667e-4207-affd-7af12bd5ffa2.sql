
CREATE OR REPLACE FUNCTION public.complete_cv_analysis(p_queue_id uuid, p_success boolean, p_error_message text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cv_analysis_queue
  SET
    status = CASE
      WHEN p_success THEN 'completed'
      WHEN attempts < max_attempts THEN 'pending'   -- automatisk återkö
      ELSE 'failed'
    END,
    completed_at = CASE WHEN p_success OR attempts >= max_attempts THEN now() ELSE NULL END,
    started_at = CASE WHEN p_success OR attempts >= max_attempts THEN started_at ELSE NULL END,
    error_message = p_error_message,
    updated_at = now()
  WHERE id = p_queue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cv_queue_batch(p_batch_size integer DEFAULT 5)
RETURNS TABLE(id uuid, applicant_id uuid, application_id uuid, job_id uuid, cv_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Återta jobb som fastnat i 'processing' (t.ex. om funktionen kraschade)
  UPDATE cv_analysis_queue
  SET status = 'pending', started_at = NULL, updated_at = now()
  WHERE status = 'processing'
    AND started_at < now() - interval '15 minutes'
    AND attempts < max_attempts;

  RETURN QUERY
  UPDATE cv_analysis_queue q
  SET
    status = 'processing',
    started_at = now(),
    attempts = attempts + 1,
    updated_at = now()
  WHERE q.id IN (
    SELECT cq.id
    FROM cv_analysis_queue cq
    WHERE cq.status = 'pending'
      AND cq.attempts < cq.max_attempts
    ORDER BY cq.priority DESC, cq.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.id, q.applicant_id, q.application_id, q.job_id, q.cv_url;
END;
$$;

-- Lägger tillbaka CV som saknar analys (t.ex. om AI-tjänsten varit nere)
CREATE OR REPLACE FUNCTION public.requeue_missing_cv_analyses(p_limit integer DEFAULT 25)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  -- 1) Ge misslyckade försök en ny chans efter 30 minuter
  UPDATE cv_analysis_queue
  SET status = 'pending', attempts = 0, started_at = NULL, completed_at = NULL, updated_at = now()
  WHERE status = 'failed'
    AND updated_at < now() - interval '30 minutes'
    AND created_at > now() - interval '7 days';

  -- 2) Köa CV som helt saknar giltig analys
  WITH candidates AS (
    SELECT p.id AS applicant_id, p.cv_url
    FROM profiles p
    LEFT JOIN profile_cv_summaries s
      ON s.user_id = p.id AND s.cv_url = p.cv_url AND coalesce(s.summary_text, '') <> ''
    WHERE p.cv_url IS NOT NULL
      AND p.cv_url <> ''
      AND s.id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM cv_analysis_queue q
        WHERE q.applicant_id = p.id
          AND q.cv_url = p.cv_url
          AND (q.status IN ('pending', 'processing')
               OR (q.status = 'failed' AND q.updated_at > now() - interval '30 minutes')
               OR (q.status = 'completed' AND q.completed_at > now() - interval '30 minutes'))
      )
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
