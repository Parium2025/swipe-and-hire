SELECT cron.unschedule('criteria-eval-worker-sweeper')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'criteria-eval-worker-sweeper');

SELECT cron.schedule(
  'criteria-eval-worker-sweeper',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/criteria-eval-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object('hop', 0, 'source', 'cron')
  )
  WHERE EXISTS (
    SELECT 1 FROM public.criteria_eval_runs r
    WHERE r.status IN ('pending', 'running')
      AND (r.lease_until IS NULL OR r.lease_until < now())
  );
  $$
);