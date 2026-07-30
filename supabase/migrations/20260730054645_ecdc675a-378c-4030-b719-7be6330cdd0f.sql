-- 1) Hälsoläge för schemalagda jobb (för larm om något tystnar)
CREATE OR REPLACE FUNCTION public.get_cron_job_health()
RETURNS TABLE (
  jobname text,
  schedule text,
  active boolean,
  last_run_at timestamptz,
  last_status text,
  last_success_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    (SELECT max(d.start_time) FROM cron.job_run_details d WHERE d.jobid = j.jobid),
    (SELECT d.status FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1)::text,
    (SELECT max(d.start_time) FROM cron.job_run_details d WHERE d.jobid = j.jobid AND d.status = 'succeeded')
  FROM cron.job j
$$;

REVOKE EXECUTE ON FUNCTION public.get_cron_job_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_job_health() TO service_role;

-- 2) Enkel räknartabell för hastighetsbegränsning av publika e-postanrop
CREATE TABLE public.rate_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate limits"
ON public.rate_limits
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _key text,
  _limit integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hits integer;
BEGIN
  INSERT INTO public.rate_limits AS rl (bucket_key, window_start, hits, updated_at)
  VALUES (_key, now(), 1, now())
  ON CONFLICT (bucket_key) DO UPDATE
    SET hits = CASE
                 WHEN rl.window_start < now() - make_interval(secs => _window_seconds) THEN 1
                 ELSE rl.hits + 1
               END,
        window_start = CASE
                 WHEN rl.window_start < now() - make_interval(secs => _window_seconds) THEN now()
                 ELSE rl.window_start
               END,
        updated_at = now()
  RETURNING rl.hits INTO v_hits;

  RETURN v_hits <= _limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;