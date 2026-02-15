
-- Drop and recreate register_session with updated cleanup threshold
DROP FUNCTION IF EXISTS public.register_session(text, text, text, text);

CREATE FUNCTION public.register_session(
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
  v_active_count int;
  v_oldest_session record;
  v_max_sessions int := 2;
  v_kicked_device text := NULL;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Clean up stale sessions (no heartbeat for 20+ min — buffer since heartbeat is every 5 min)
  DELETE FROM user_sessions
  WHERE user_id = v_user_id
    AND last_heartbeat_at < now() - interval '20 minutes';

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
$$;

-- Update get_active_sessions: remove the 10-min heartbeat filter
CREATE OR REPLACE FUNCTION public.get_active_sessions()
RETURNS TABLE (
  id uuid,
  session_token text,
  device_label text,
  created_at timestamptz,
  last_heartbeat_at timestamptz,
  is_current boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    us.id,
    us.session_token,
    us.device_label,
    us.created_at,
    us.last_heartbeat_at,
    false as is_current
  FROM user_sessions us
  WHERE us.user_id = auth.uid()
  ORDER BY us.created_at DESC;
END;
$$;
