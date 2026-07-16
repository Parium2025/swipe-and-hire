CREATE OR REPLACE FUNCTION public.get_news_cron_health()
RETURNS TABLE(jobname text, schedule text, command text, active boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT j.jobname::text, j.schedule::text, j.command::text, j.active
  FROM cron.job j
  WHERE j.jobname ILIKE '%news%'
     OR j.jobname ILIKE '%career%'
     OR j.command ILIKE '%fetch-hr-news%'
     OR j.command ILIKE '%fetch-career-tips%'
     OR j.command ILIKE '%news-health-watchdog%'
  ORDER BY j.jobname;
$$;

REVOKE ALL ON FUNCTION public.get_news_cron_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_news_cron_health() TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_news_health_watchdog()
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
    RAISE EXCEPTION 'Missing service role key for news watchdog';
  END IF;

  PERFORM net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/news-health-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_news_health_watchdog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_news_health_watchdog() TO service_role;

UPDATE public.rss_source_health
SET source_type = 'hr_news',
    last_check_at = COALESCE(last_check_at, last_success_at, last_failure_at, updated_at),
    total_fetches = GREATEST(COALESCE(total_fetches, 0), COALESCE(total_successes, 0) + COALESCE(total_failures, 0)),
    successful_fetches = GREATEST(COALESCE(successful_fetches, 0), COALESCE(total_successes, 0)),
    is_active = COALESCE(is_active, true)
WHERE source_type IS NULL OR source_type = 'hr_news';