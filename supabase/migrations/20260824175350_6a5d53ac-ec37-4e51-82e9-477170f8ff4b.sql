CREATE OR REPLACE FUNCTION public.resume_paused_criteria_eval_runs(p_min_age_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH resumed AS (
    UPDATE public.criteria_eval_runs r
    SET status = 'pending',
        pause_reason = NULL,
        lease_until = NULL
    WHERE r.status = 'paused'
      AND r.pause_reason IN ('credits_exhausted', 'rate_limited', 'blocked')
      AND r.updated_at < now() - make_interval(mins => GREATEST(1, p_min_age_minutes))
    RETURNING r.id
  )
  SELECT count(*) INTO v_count FROM resumed;

  UPDATE public.criteria_eval_items i
  SET status = 'pending', attempts = GREATEST(0, i.attempts - 1)
  WHERE i.status = 'failed'
    AND i.run_id IN (SELECT id FROM public.criteria_eval_runs WHERE status = 'pending');

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resume_paused_criteria_eval_runs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resume_paused_criteria_eval_runs(integer) TO service_role;

SELECT cron.unschedule('criteria-eval-worker-sweeper')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'criteria-eval-worker-sweeper');

SELECT cron.schedule(
  'criteria-eval-worker-sweeper',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/criteria-eval-worker',
       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)),
       body := '{"hop": 0, "source": "cron"}'::jsonb
     ); $$
);