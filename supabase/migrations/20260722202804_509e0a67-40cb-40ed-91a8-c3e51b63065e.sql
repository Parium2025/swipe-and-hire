ALTER TABLE public.criterion_results
  ADD COLUMN IF NOT EXISTS criterion_hash TEXT,
  ADD COLUMN IF NOT EXISTS context_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_criterion_results_hashes
  ON public.criterion_results(criterion_id, criterion_hash, context_hash);