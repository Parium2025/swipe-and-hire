-- A browser/device token is only unique within an account. The same browser may
-- legitimately be used by different accounts over time.
ALTER TABLE public.user_sessions
  DROP CONSTRAINT IF EXISTS user_sessions_session_token_key;

ALTER TABLE public.user_sessions
  ADD CONSTRAINT user_sessions_user_token_key UNIQUE (user_id, session_token);

CREATE OR REPLACE FUNCTION public.register_session(
  p_session_token text,
  p_device_label text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_active_count integer;
  v_oldest_session record;
  v_max_sessions constant integer := 2;
  v_kicked_device text := NULL;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_session_token IS NULL OR length(p_session_token) < 16 OR length(p_session_token) > 200 THEN
    RAISE EXCEPTION 'Invalid session token';
  END IF;

  -- Serialize every count/kick/insert decision for this account. Without this,
  -- concurrent tabs can both observe one row and both insert, creating 3 rows.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  UPDATE public.user_sessions
  SET last_heartbeat_at = now(),
      device_label = left(p_device_label, 120),
      user_agent = left(p_user_agent, 200)
  WHERE user_id = v_user_id
    AND session_token = p_session_token;

  IF FOUND THEN
    RETURN jsonb_build_object('status', 'ok');
  END IF;

  DELETE FROM public.user_sessions
  WHERE user_id = v_user_id
    AND last_heartbeat_at < now() - interval '20 minutes';

  SELECT count(*)
  INTO v_active_count
  FROM public.user_sessions
  WHERE user_id = v_user_id;

  IF v_active_count >= v_max_sessions THEN
    SELECT id, device_label
    INTO v_oldest_session
    FROM public.user_sessions
    WHERE user_id = v_user_id
    ORDER BY created_at ASC, id ASC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      v_kicked_device := v_oldest_session.device_label;
      DELETE FROM public.user_sessions WHERE id = v_oldest_session.id;
    END IF;
  END IF;

  INSERT INTO public.user_sessions (
    user_id, session_token, device_label, ip_address, user_agent
  ) VALUES (
    v_user_id,
    p_session_token,
    left(p_device_label, 120),
    p_ip_address,
    left(p_user_agent, 200)
  )
  ON CONFLICT (user_id, session_token) DO UPDATE
  SET last_heartbeat_at = now(),
      device_label = EXCLUDED.device_label,
      user_agent = EXCLUDED.user_agent;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_kicked_device IS NOT NULL THEN 'kicked_oldest' ELSE 'ok' END,
    'kicked_device', v_kicked_device,
    'new_device', left(p_device_label, 120)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reregister_session(
  p_session_token text,
  p_device_label text,
  p_user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_active_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_session_token IS NULL OR length(p_session_token) < 16 OR length(p_session_token) > 200 THEN
    RAISE EXCEPTION 'Invalid session token';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  UPDATE public.user_sessions
  SET last_heartbeat_at = now(),
      device_label = left(p_device_label, 120),
      user_agent = left(p_user_agent, 200)
  WHERE user_id = v_user_id
    AND session_token = p_session_token;

  IF FOUND THEN
    RETURN jsonb_build_object('status', 'ok');
  END IF;

  DELETE FROM public.user_sessions
  WHERE user_id = v_user_id
    AND last_heartbeat_at < now() - interval '20 minutes';

  SELECT count(*)
  INTO v_active_count
  FROM public.user_sessions
  WHERE user_id = v_user_id;

  IF v_active_count >= 2 THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'session_limit_reached');
  END IF;

  INSERT INTO public.user_sessions (user_id, session_token, device_label, user_agent)
  VALUES (
    v_user_id,
    p_session_token,
    left(p_device_label, 120),
    left(p_user_agent, 200)
  )
  ON CONFLICT (user_id, session_token) DO UPDATE
  SET last_heartbeat_at = now(),
      device_label = EXCLUDED.device_label,
      user_agent = EXCLUDED.user_agent;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.register_session(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reregister_session(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_session(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reregister_session(text, text, text) TO authenticated, service_role;