CREATE TABLE IF NOT EXISTS public.account_deletion_queue (
  user_id uuid PRIMARY KEY,
  email text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

GRANT ALL ON public.account_deletion_queue TO service_role;
ALTER TABLE public.account_deletion_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_account_deletion_queue_status
  ON public.account_deletion_queue (status, requested_at);

CREATE OR REPLACE FUNCTION public.claim_account_deletions(_limit integer DEFAULT 5)
RETURNS SETOF public.account_deletion_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.account_deletion_queue q
  SET status = 'processing', started_at = now(), attempts = q.attempts + 1
  WHERE q.user_id IN (
    SELECT c.user_id FROM public.account_deletion_queue c
    WHERE c.status = 'pending'
       OR (c.status = 'processing' AND c.started_at < now() - interval '15 minutes')
       OR (c.status = 'failed' AND c.attempts < 5 AND c.started_at < now() - interval '10 minutes')
    ORDER BY c.requested_at
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_account_deletions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_account_deletions(integer) TO service_role;