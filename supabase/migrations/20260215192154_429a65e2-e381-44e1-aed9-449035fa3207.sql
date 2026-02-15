
CREATE OR REPLACE FUNCTION public.register_session(p_session_token text, p_device_label text DEFAULT NULL::text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_active_count int;
  v_oldest_session record;
  v_max_sessions int := 2;
  v_kicked_device text := NULL;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Clean up stale sessions first (no heartbeat for 10+ min)
  DELETE FROM user_sessions
  WHERE user_id = v_user_id
    AND last_heartbeat_at < now() - interval '10 minutes';

  -- Remove duplicate token if exists (re-registration)
  DELETE FROM user_sessions WHERE session_token = p_session_token;

  -- Count current active sessions
  SELECT COUNT(*) INTO v_active_count
  FROM user_sessions
  WHERE user_id = v_user_id;

  -- If at max, kick the oldest
  IF v_active_count >= v_max_sessions THEN
    SELECT id, session_token, device_label INTO v_oldest_session
    FROM user_sessions
    WHERE user_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- Only delete if we actually found a session (race condition safety)
    IF FOUND THEN
      v_kicked_device := v_oldest_session.device_label;
      DELETE FROM user_sessions WHERE id = v_oldest_session.id;
    END IF;
  END IF;

  -- Register the new session
  INSERT INTO user_sessions (user_id, session_token, device_label, ip_address, user_agent)
  VALUES (v_user_id, p_session_token, p_device_label, p_ip_address, p_user_agent);

  RETURN jsonb_build_object(
    'status', CASE WHEN v_active_count >= v_max_sessions AND v_kicked_device IS NOT NULL THEN 'kicked_oldest' ELSE 'ok' END,
    'kicked_device', v_kicked_device,
    'new_device', p_device_label
  );
END;
$function$;
