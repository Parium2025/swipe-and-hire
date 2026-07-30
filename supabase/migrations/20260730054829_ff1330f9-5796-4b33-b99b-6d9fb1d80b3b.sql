CREATE OR REPLACE FUNCTION public.trigger_cron_health_watchdog()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE EXCEPTION 'Missing service role key for cron watchdog';
  END IF;

  PERFORM net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/cron-health-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_cron_health_watchdog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_cron_health_watchdog() TO service_role;

SELECT cron.unschedule('cron-health-watchdog-morning')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron-health-watchdog-morning');
SELECT cron.unschedule('cron-health-watchdog-evening')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron-health-watchdog-evening');

-- Efter data-retention (03:30) och inactive-account-retention (04:15)
SELECT cron.schedule(
  'cron-health-watchdog-morning',
  '45 5 * * *',
  $$SELECT public.trigger_cron_health_watchdog();$$
);

SELECT cron.schedule(
  'cron-health-watchdog-evening',
  '45 17 * * *',
  $$SELECT public.trigger_cron_health_watchdog();$$
);