select cron.schedule(
  'app-exception-watchdog-quarterhour',
  '*/15 * * * *',
  $$select net.http_post(
      url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/app-exception-watchdog',
      headers := public.cron_auth_header(),
      body := concat('{"time": "', now(), '"}')::jsonb
  );$$
);