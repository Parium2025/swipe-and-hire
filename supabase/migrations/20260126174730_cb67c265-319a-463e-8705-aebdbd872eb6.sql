-- Create cron jobs for fetch-career-tips (same schedule as HR news: 06:00, 11:00, 18:00, 23:00 UTC)

-- Helper function for career tips (same pattern as trigger_hr_news_fetch)
CREATE OR REPLACE FUNCTION public.trigger_career_tips_fetch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/fetch-career-tips',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyamFlZ2FwdXVqdXNoc2lvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjkzMjYsImV4cCI6MjA3OTE0NTMyNn0.mEr8DfMmx8kAX7YttCGEX9B4CZZcoo8l_rI0-EFFpQA"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule career tips fetching 4 times daily (same as HR news)
SELECT cron.schedule(
  'fetch-career-tips-morning',
  '0 6 * * *',
  'SELECT public.trigger_career_tips_fetch()'
);

SELECT cron.schedule(
  'fetch-career-tips-midday',
  '0 11 * * *',
  'SELECT public.trigger_career_tips_fetch()'
);

SELECT cron.schedule(
  'fetch-career-tips-evening',
  '0 18 * * *',
  'SELECT public.trigger_career_tips_fetch()'
);

SELECT cron.schedule(
  'fetch-career-tips-night',
  '0 23 * * *',
  'SELECT public.trigger_career_tips_fetch()'
);