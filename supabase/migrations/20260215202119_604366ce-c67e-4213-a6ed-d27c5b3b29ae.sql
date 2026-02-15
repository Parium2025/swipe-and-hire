
-- New function: reregister_session
-- Used when a session was cleaned by cron (not kicked by another device).
-- It NEVER kicks other sessions and it does NOT reset the original join order.
-- If 2+ other sessions already exist, it returns 'rejected' (genuinely kicked).
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
  v_active_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- If the token still exists somehow, just bump heartbeat and return ok
  UPDATE user_sessions
  SET last_heartbeat_at = now()
  WHERE session_token = p_session_token AND user_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('status', 'ok');
  END IF;

  -- Token is gone — count how many OTHER sessions exist
  SELECT COUNT(*) INTO v_active_count
  FROM user_sessions
  WHERE user_id = v_user_id;

  -- If already 2+ sessions, this device was genuinely kicked — reject
  IF v_active_count >= 2 THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'session_limit_reached');
  END IF;

  -- Safe to re-register (cron cleanup). Insert with current time.
  -- This is fine because the OTHER sessions keep their original created_at,
  -- so kick order is preserved for them.
  INSERT INTO user_sessions (user_id, session_token, device_label, user_agent)
  VALUES (v_user_id, p_session_token, p_device_label, p_user_agent);

  RETURN jsonb_build_object('status', 'ok');
END;
$$;
