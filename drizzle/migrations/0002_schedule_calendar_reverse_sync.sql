-- lovable-cron-fallback-reviewed: 288 runs/day; external calendar providers (Google/Outlook) offer no simple webhook into this app — polling upcoming interviews' events is the only reliable way to detect times moved directly in the user's calendar, and interviews are time-critical (max 5 min detection delay required). DB already runs minutely maintenance crons, so marginal cost is negligible.
-- Omvänd kalendersynk: flyttar en bokare intervjun direkt i Google/Outlook
-- uppdateras intervjun i appen (aktivitetslogg + notiser via befintliga triggers).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calendar-reverse-sync-5min') THEN
    PERFORM cron.unschedule('calendar-reverse-sync-5min');
  END IF;
END $$;

SELECT cron.schedule(
  'calendar-reverse-sync-5min',
  '3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
  $cron$select net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/calendar-reverse-sync',
    headers := public.cron_auth_header(),
    body := concat('{"time": "', now(), '"}')::jsonb
  )$cron$
);