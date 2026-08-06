-- Session rows are mutated only through the scoped SECURITY DEFINER RPCs.
-- Direct table writes could otherwise bypass the two-device invariant.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_sessions FROM authenticated;

DROP POLICY IF EXISTS "Users can register sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.user_sessions;

-- Defense in depth: no current or future write path may leave an account with
-- more than two tracked devices. The advisory lock is re-entrant inside the
-- transaction and matches register_session/reregister_session.
CREATE OR REPLACE FUNCTION public.enforce_max_user_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF (
    SELECT count(*)
    FROM public.user_sessions
    WHERE user_id = NEW.user_id
  ) > 2 THEN
    RAISE EXCEPTION 'session_limit_exceeded' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS enforce_max_user_sessions_trigger ON public.user_sessions;
CREATE CONSTRAINT TRIGGER enforce_max_user_sessions_trigger
AFTER INSERT ON public.user_sessions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_max_user_sessions();

REVOKE ALL ON FUNCTION public.enforce_max_user_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_max_user_sessions() TO service_role;

CREATE OR REPLACE FUNCTION public.get_active_sessions()
RETURNS TABLE (
  id uuid,
  session_token text,
  device_label text,
  created_at timestamptz,
  last_heartbeat_at timestamptz,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    us.id,
    us.session_token,
    us.device_label,
    us.created_at,
    us.last_heartbeat_at,
    false AS is_current
  FROM public.user_sessions us
  WHERE us.user_id = auth.uid()
    AND us.last_heartbeat_at >= now() - interval '20 minutes'
  ORDER BY us.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_active_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_sessions() TO authenticated, service_role;