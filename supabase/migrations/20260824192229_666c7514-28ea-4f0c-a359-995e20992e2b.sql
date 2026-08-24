CREATE TABLE IF NOT EXISTS public.job_run_locks (
  key text PRIMARY KEY,
  locked_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.job_run_locks TO service_role;
ALTER TABLE public.job_run_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.try_claim_job_lock(_key text, _ttl_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed boolean;
BEGIN
  INSERT INTO public.job_run_locks AS l (key, locked_until, updated_at)
  VALUES (_key, now() + make_interval(secs => _ttl_seconds), now())
  ON CONFLICT (key) DO UPDATE
    SET locked_until = now() + make_interval(secs => _ttl_seconds),
        updated_at = now()
    WHERE l.locked_until < now()
  RETURNING true INTO _claimed;

  RETURN COALESCE(_claimed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_job_lock(_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.job_run_locks SET locked_until = now() - interval '1 second', updated_at = now() WHERE key = _key;
$$;

REVOKE EXECUTE ON FUNCTION public.try_claim_job_lock(text, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_job_lock(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_claim_job_lock(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_job_lock(text) TO service_role;