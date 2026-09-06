-- Samlade underhållsfunktioner: ett anrop per intervall istället för flera
-- parallella cron-jobb (databasen har bara sex bakgrundsprocesser).
-- Varje steg har egen felhantering så ett fel aldrig stoppar de andra.
CREATE OR REPLACE FUNCTION public.run_minutely_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.cleanup_expired_rate_limits(5000);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'cleanup_expired_rate_limits failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM net.http_post(
      url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/process-cv-queue',
      headers := public.cron_auth_header(),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'process-cv-queue dispatch failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM net.http_post(
      url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/interview-reminders',
      headers := public.cron_auth_header(),
      body := concat('{"time": "', now(), '"}')::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'interview-reminders dispatch failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM net.http_post(
      url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/outreach-dispatch',
      headers := public.cron_auth_header(),
      body := concat('{"time": "', now(), '"}')::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'outreach-dispatch failed: %', SQLERRM;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_five_minute_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/criteria-eval-worker',
      headers := public.cron_auth_header(),
      body := '{"hop": 0, "source": "cron"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'criteria-eval-worker dispatch failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM net.http_post(
      url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/process-account-deletions',
      headers := public.cron_auth_header(),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'process-account-deletions dispatch failed: %', SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.run_minutely_maintenance() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_minutely_maintenance() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.run_five_minute_maintenance() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_five_minute_maintenance() FROM anon, authenticated;
