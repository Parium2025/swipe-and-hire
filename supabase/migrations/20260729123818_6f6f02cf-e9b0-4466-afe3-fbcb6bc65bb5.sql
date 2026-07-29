CREATE TABLE IF NOT EXISTS public.account_inactivity_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text,
  last_active_at timestamptz,
  warned_at timestamptz NOT NULL DEFAULT now(),
  scheduled_delete_at timestamptz NOT NULL,
  deleted_at timestamptz,
  cancelled_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.account_inactivity_notices TO service_role;
GRANT SELECT ON public.account_inactivity_notices TO authenticated;

ALTER TABLE public.account_inactivity_notices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_inactivity_notices'
      AND policyname = 'Platform admins can view inactivity notices'
  ) THEN
    CREATE POLICY "Platform admins can view inactivity notices"
      ON public.account_inactivity_notices FOR SELECT TO authenticated
      USING (public.is_platform_admin(auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_inactivity_pending
  ON public.account_inactivity_notices (scheduled_delete_at)
  WHERE deleted_at IS NULL AND cancelled_at IS NULL;

DROP TRIGGER IF EXISTS set_account_inactivity_notices_updated_at ON public.account_inactivity_notices;
CREATE TRIGGER set_account_inactivity_notices_updated_at
  BEFORE UPDATE ON public.account_inactivity_notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.trigger_inactive_account_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE NOTICE 'inactive-account-retention: missing cron secret, skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/inactive-account-retention',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_inactive_account_retention() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.trigger_inactive_account_retention() TO service_role, postgres;

SELECT cron.unschedule('inactive-account-retention-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inactive-account-retention-daily');

SELECT cron.schedule(
  'inactive-account-retention-daily',
  '15 4 * * *',
  $cron$ SELECT public.trigger_inactive_account_retention(); $cron$
);