ALTER TABLE public.outreach_dispatch_logs
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_odl_retry
  ON public.outreach_dispatch_logs (next_attempt_at)
  WHERE status = 'retrying';