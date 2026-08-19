ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE OR REPLACE FUNCTION public.kick_session(p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE user_sessions
  SET revoked_at = now(),
      last_heartbeat_at = now()
  WHERE id = p_session_id
    AND user_id = auth.uid()
    AND revoked_at IS NULL;
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_sessions()
RETURNS TABLE(id uuid, session_token text, device_label text, created_at timestamp with time zone, last_heartbeat_at timestamp with time zone, is_current boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT us.id, us.session_token, us.device_label, us.created_at, us.last_heartbeat_at, false AS is_current
  FROM public.user_sessions us
  WHERE us.user_id = auth.uid()
    AND us.revoked_at IS NULL
    AND us.last_heartbeat_at >= now() - interval '5 minutes'
  ORDER BY us.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.is_session_valid(p_session_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_sessions
    WHERE session_token = p_session_token
      AND user_id = auth.uid()
      AND revoked_at IS NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.heartbeat_session(p_session_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE user_sessions
  SET last_heartbeat_at = now()
  WHERE session_token = p_session_token
    AND user_id = auth.uid()
    AND revoked_at IS NULL;
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_session(p_session_token text, p_device_label text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_active_count integer;
  v_oldest_session record;
  v_max_sessions constant integer := 2;
  v_kicked_device text := NULL;
  v_revoked boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_session_token IS NULL OR length(p_session_token) < 16 OR length(p_session_token) > 200 THEN
    RAISE EXCEPTION 'Invalid session token';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  -- Remotely signed out from another device: consume the tombstone once so a
  -- fresh login on this device works, and tell the client to sign out.
  SELECT true INTO v_revoked
  FROM public.user_sessions
  WHERE user_id = v_user_id AND session_token = p_session_token AND revoked_at IS NOT NULL
  LIMIT 1;

  IF v_revoked THEN
    DELETE FROM public.user_sessions
    WHERE user_id = v_user_id AND session_token = p_session_token AND revoked_at IS NOT NULL;
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

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
    AND last_heartbeat_at < now() - interval '5 minutes';

  SELECT count(*) INTO v_active_count
  FROM public.user_sessions
  WHERE user_id = v_user_id AND revoked_at IS NULL;

  IF v_active_count >= v_max_sessions THEN
    SELECT id, device_label INTO v_oldest_session
    FROM public.user_sessions
    WHERE user_id = v_user_id AND revoked_at IS NULL
    ORDER BY created_at ASC, id ASC
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      v_kicked_device := v_oldest_session.device_label;
      DELETE FROM public.user_sessions WHERE id = v_oldest_session.id;
    END IF;
  END IF;

  INSERT INTO public.user_sessions (user_id, session_token, device_label, ip_address, user_agent)
  VALUES (v_user_id, p_session_token, left(p_device_label, 120), p_ip_address, left(p_user_agent, 200))
  ON CONFLICT (user_id, session_token) DO UPDATE
  SET last_heartbeat_at = now(),
      revoked_at = NULL,
      device_label = EXCLUDED.device_label,
      user_agent = EXCLUDED.user_agent;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_kicked_device IS NOT NULL THEN 'kicked_oldest' ELSE 'ok' END,
    'kicked_device', v_kicked_device,
    'new_device', left(p_device_label, 120)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reregister_session(p_session_token text, p_device_label text, p_user_agent text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_active_count integer;
  v_revoked boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_session_token IS NULL OR length(p_session_token) < 16 OR length(p_session_token) > 200 THEN
    RAISE EXCEPTION 'Invalid session token';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  SELECT true INTO v_revoked
  FROM public.user_sessions
  WHERE user_id = v_user_id AND session_token = p_session_token AND revoked_at IS NOT NULL
  LIMIT 1;

  IF v_revoked THEN
    DELETE FROM public.user_sessions
    WHERE user_id = v_user_id AND session_token = p_session_token AND revoked_at IS NOT NULL;
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'revoked');
  END IF;

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
    AND last_heartbeat_at < now() - interval '5 minutes';

  SELECT count(*) INTO v_active_count
  FROM public.user_sessions
  WHERE user_id = v_user_id AND revoked_at IS NULL;

  IF v_active_count >= 2 THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'session_limit_reached');
  END IF;

  INSERT INTO public.user_sessions (user_id, session_token, device_label, user_agent)
  VALUES (v_user_id, p_session_token, left(p_device_label, 120), left(p_user_agent, 200))
  ON CONFLICT (user_id, session_token) DO UPDATE
  SET last_heartbeat_at = now(),
      revoked_at = NULL,
      device_label = EXCLUDED.device_label,
      user_agent = EXCLUDED.user_agent;

  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_max_user_sessions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF (
    SELECT count(*) FROM public.user_sessions
    WHERE user_id = NEW.user_id AND revoked_at IS NULL
  ) > 2 THEN
    RAISE EXCEPTION 'session_limit_exceeded' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM user_sessions
  WHERE (revoked_at IS NULL AND last_heartbeat_at < now() - interval '5 minutes')
     OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '24 hours');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;