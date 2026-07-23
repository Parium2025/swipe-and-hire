
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  user_id UUID,
  employer_id UUID,
  organization_id UUID,
  job_id UUID,
  applicant_id UUID,
  criteria_count INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  fresh_calls INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  model TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_usage_log TO service_role;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON public.ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_employer ON public.ai_usage_log (employer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_job ON public.ai_usage_log (job_id, created_at DESC);
