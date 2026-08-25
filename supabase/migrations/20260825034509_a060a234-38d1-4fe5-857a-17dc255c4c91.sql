ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_interviews_reminder_pending
  ON public.interviews (scheduled_at)
  WHERE reminder_sent_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue-sweeper') THEN
    PERFORM cron.unschedule('process-email-queue-sweeper');
  END IF;
END $$;