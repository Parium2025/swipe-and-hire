-- Atomic, IP-first reservations for anonymous Auth edge functions.
-- Expand-only: the legacy consume_rate_limit(text, integer, integer) function
-- remains available until every deployed caller uses reserve_rate_limits(jsonb).

ALTER TABLE public.rate_limits
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.rate_limits
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '1 hour');

-- Do not surprise production with a long blocking index build. Historic rows
-- are deliberately left nullable and age out through the bounded cleanup job.
DO $preflight$
DECLARE
  v_estimated_rows bigint;
BEGIN
  SELECT GREATEST(reltuples, 0)::bigint
  INTO v_estimated_rows
  FROM pg_catalog.pg_class
  WHERE oid = 'public.rate_limits'::regclass;

  IF COALESCE(v_estimated_rows, 0) > 100000 THEN
    RAISE EXCEPTION
      'rate_limits has approximately % rows; build the expiry index concurrently in a staged rollout',
      v_estimated_rows;
  END IF;
END
$preflight$;

CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx
  ON public.rate_limits (expires_at);

REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO service_role;

-- Keep the legacy signature rollout-safe while old Edge instances drain.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _key text,
  _limit integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hits integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF _key IS NULL
     OR _key = ''
     OR length(_key) > 512
     OR _limit < 1
     OR _limit > 100000
     OR _window_seconds < 1
     OR _window_seconds > 604800 THEN
    RAISE EXCEPTION 'invalid legacy rate-limit reservation'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rate_limits AS rl (
    bucket_key,
    window_start,
    hits,
    updated_at,
    expires_at
  )
  VALUES (
    _key,
    v_now,
    1,
    v_now,
    v_now + make_interval(secs => _window_seconds)
  )
  ON CONFLICT (bucket_key) DO UPDATE
    SET hits = CASE
          WHEN rl.expires_at IS NULL OR rl.expires_at <= v_now THEN 1
          ELSE LEAST(rl.hits, _limit) + 1
        END,
        window_start = CASE
          WHEN rl.expires_at IS NULL OR rl.expires_at <= v_now THEN v_now
          ELSE rl.window_start
        END,
        updated_at = v_now,
        expires_at = CASE
          WHEN rl.expires_at IS NULL OR rl.expires_at <= v_now
            THEN v_now + make_interval(secs => _window_seconds)
          ELSE rl.expires_at
        END
  RETURNING rl.hits INTO v_hits;

  RETURN v_hits <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits(
  _batch_size integer DEFAULT 128
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  WITH expired AS (
    SELECT rl.bucket_key
    FROM public.rate_limits AS rl
    WHERE rl.expires_at <= clock_timestamp()
       OR (
         rl.expires_at IS NULL
         AND rl.updated_at <= clock_timestamp() - interval '1 hour'
       )
    ORDER BY rl.expires_at NULLS FIRST, rl.updated_at, rl.bucket_key
    LIMIT LEAST(GREATEST(COALESCE(_batch_size, 128), 1), 5000)
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.rate_limits AS rl
    USING expired
    WHERE rl.bucket_key = expired.bucket_key
    RETURNING 1
  )
  SELECT count(*)::integer
  INTO v_deleted
  FROM deleted;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limits(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits(integer)
  TO service_role;

-- Cleanup is intentionally outside reservation transactions. Inline deletion
-- can deadlock when concurrent requests later reserve each other's buckets.
DO $schedule$
DECLARE
  v_job_id bigint;
BEGIN
  IF pg_catalog.to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron is unavailable; schedule cleanup_expired_rate_limits externally';
    RETURN;
  END IF;

  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-expired-rate-limits'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'cleanup-expired-rate-limits',
    '* * * * *',
    'SELECT public.cleanup_expired_rate_limits(5000)'
  );
END
$schedule$;

CREATE OR REPLACE FUNCTION public.reserve_rate_limits(_rules jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rule jsonb;
  v_ordinality integer;
  v_scope text;
  v_key text;
  v_limit integer;
  v_window_seconds integer;
  v_hits integer;
  v_expires_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_seen_scopes text[] := ARRAY[]::text[];
BEGIN
  IF _rules IS NULL
     OR jsonb_typeof(_rules) <> 'array'
     OR jsonb_array_length(_rules) < 1
     OR jsonb_array_length(_rules) > 8 THEN
    RAISE EXCEPTION 'invalid rate-limit reservation'
      USING ERRCODE = '22023';
  END IF;

  FOR v_rule, v_ordinality IN
    SELECT input.value, input.ordinality::integer
    FROM jsonb_array_elements(_rules) WITH ORDINALITY AS input(value, ordinality)
    ORDER BY input.ordinality
  LOOP
    IF jsonb_typeof(v_rule) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_rule -> 'scope') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_rule -> 'key') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_rule -> 'limit') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_rule -> 'window_seconds') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'invalid rate-limit rule'
        USING ERRCODE = '22023';
    END IF;

    v_scope := v_rule ->> 'scope';
    v_key := v_rule ->> 'key';

    IF (v_rule ->> 'limit') !~ '^[1-9][0-9]{0,8}$'
       OR (v_rule ->> 'window_seconds') !~ '^[1-9][0-9]{0,8}$' THEN
      RAISE EXCEPTION 'invalid rate-limit bounds'
        USING ERRCODE = '22023';
    END IF;

    v_limit := (v_rule ->> 'limit')::integer;
    v_window_seconds := (v_rule ->> 'window_seconds')::integer;

    IF v_scope = ''
       OR length(v_scope) > 64
       OR v_key = ''
       OR length(v_key) > 512
       OR v_limit > 100000
       OR v_window_seconds > 604800 THEN
      RAISE EXCEPTION 'rate-limit rule outside accepted bounds'
        USING ERRCODE = '22023';
    END IF;

    IF v_scope = ANY(v_seen_scopes) THEN
      RAISE EXCEPTION 'duplicate rate-limit scope'
        USING ERRCODE = '22023';
    END IF;
    v_seen_scopes := pg_catalog.array_append(v_seen_scopes, v_scope);

    -- All callers must serialize on the same coarse IP bucket first. If that
    -- bucket is blocked, RETURN stops before any email/token bucket is touched.
    IF v_ordinality = 1 AND v_scope <> 'ip' THEN
      RAISE EXCEPTION 'first rate-limit rule must be IP'
        USING ERRCODE = '22023';
    ELSIF v_ordinality > 1 AND v_scope = 'ip' THEN
      RAISE EXCEPTION 'IP rate-limit rule must be unique and first'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.rate_limits AS rl (
      bucket_key,
      window_start,
      hits,
      updated_at,
      expires_at
    )
    VALUES (
      v_key,
      v_now,
      1,
      v_now,
      v_now + make_interval(secs => v_window_seconds)
    )
    ON CONFLICT (bucket_key) DO UPDATE
      SET hits = CASE
            WHEN rl.expires_at IS NULL OR rl.expires_at <= v_now THEN 1
            ELSE LEAST(rl.hits, v_limit) + 1
          END,
          window_start = CASE
            WHEN rl.expires_at IS NULL OR rl.expires_at <= v_now THEN v_now
            ELSE rl.window_start
          END,
          updated_at = v_now,
          expires_at = CASE
            WHEN rl.expires_at IS NULL OR rl.expires_at <= v_now
              THEN v_now + make_interval(secs => v_window_seconds)
            ELSE rl.expires_at
          END
    RETURNING rl.hits, rl.expires_at
    INTO v_hits, v_expires_at;

    IF v_hits > v_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'blocked_scope', v_scope,
        'retry_after_seconds', GREATEST(
          1,
          ceil(extract(epoch FROM (v_expires_at - v_now)))::integer
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_rate_limits(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_rate_limits(jsonb) TO service_role;

COMMENT ON FUNCTION public.reserve_rate_limits(jsonb) IS
  'Atomically reserves ordered public Auth rate-limit buckets; the IP bucket must be first.';
