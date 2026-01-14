-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create function to call the edge function
CREATE OR REPLACE FUNCTION public.trigger_hr_news_fetch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_anon_key text;
BEGIN
  -- Get the Supabase URL and anon key from environment
  v_url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/fetch-hr-news';
  
  -- Make HTTP request to edge function using pg_net
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyamFlZ2FwdXVqdXNoc2lvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjkzMjYsImV4cCI6MjA3OTE0NTMyNn0.mEr8DfMmx8kAX7YttCGEX9B4CZZcoo8l_rI0-EFFpQA'
    ),
    body := '{"force": true}'::jsonb
  );
END;
$$;

-- Schedule news fetch at 07:00 Stockholm time (06:00 UTC in winter, 05:00 UTC in summer)
-- Using 06:00 UTC as a reasonable middle ground
SELECT cron.schedule(
  'fetch-hr-news-morning',
  '0 6 * * *',  -- 06:00 UTC = 07:00 CET
  $$SELECT public.trigger_hr_news_fetch()$$
);

-- Schedule news fetch at 12:00 Stockholm time (11:00 UTC in winter, 10:00 UTC in summer)
SELECT cron.schedule(
  'fetch-hr-news-midday',
  '0 11 * * *',  -- 11:00 UTC = 12:00 CET
  $$SELECT public.trigger_hr_news_fetch()$$
);

-- Schedule news fetch at 19:00 Stockholm time (18:00 UTC in winter, 17:00 UTC in summer)
SELECT cron.schedule(
  'fetch-hr-news-evening',
  '0 18 * * *',  -- 18:00 UTC = 19:00 CET
  $$SELECT public.trigger_hr_news_fetch()$$
);