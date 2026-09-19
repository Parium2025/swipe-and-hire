CREATE TABLE IF NOT EXISTS public.notification_digest_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_type text NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, digest_type)
);

GRANT SELECT ON public.notification_digest_state TO authenticated;
GRANT ALL ON public.notification_digest_state TO service_role;

ALTER TABLE public.notification_digest_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own digest state" ON public.notification_digest_state;
CREATE POLICY "Users can view their own digest state"
  ON public.notification_digest_state
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

SELECT cron.unschedule('activity-digest-emails')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'activity-digest-emails');

SELECT cron.schedule(
  'activity-digest-emails',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/activity-digest-emails',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
  $$
);