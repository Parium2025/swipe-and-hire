CREATE INDEX IF NOT EXISTS idx_outreach_dispatch_logs_created_at
  ON public.outreach_dispatch_logs (created_at DESC);