SELECT cron.schedule(
  'saved-searches-full-scan-nightly',
  '40 3 * * *',
  $$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/check-saved-searches', headers := public.cron_auth_header(), body := '{}'::jsonb);$$
);