
-- Table to track active user sessions (max 2 per user)
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  device_label text, -- e.g. 'web', 'app', 'desktop'
  ip_address text,
  user_agent text,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by user
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
-- Index for cleaning up stale sessions
CREATE INDEX idx_user_sessions_heartbeat ON public.user_sessions(last_heartbeat_at);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view their own sessions"
ON public.user_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can register sessions"
ON public.user_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions (heartbeat)
CREATE POLICY "Users can update their own sessions"
ON public.user_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout)
CREATE POLICY "Users can delete their own sessions"
ON public.user_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Service role can manage all (for cleanup)
CREATE POLICY "Service role can manage all sessions"
ON public.user_sessions FOR ALL
USING (true)
WITH CHECK (true);

-- Function to register a session and enforce max 2
-- Returns 'ok' or 'kicked_oldest' or the kicked session token
CREATE OR REPLACE FUNCTION public.register_session(
  p_session_token text,
  p_device_label text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_active_count int;
  v_oldest_session record;
  v_max_sessions int := 2;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Clean up stale sessions first (no heartbeat for 30+ min)
  DELETE FROM user_sessions
  WHERE user_id = v_user_id
    AND last_heartbeat_at < now() - interval '30 minutes';

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

    DELETE FROM user_sessions WHERE id = v_oldest_session.id;
  END IF;

  -- Register the new session
  INSERT INTO user_sessions (user_id, session_token, device_label, ip_address, user_agent)
  VALUES (v_user_id, p_session_token, p_device_label, p_ip_address, p_user_agent);

  RETURN jsonb_build_object(
    'status', CASE WHEN v_active_count >= v_max_sessions THEN 'kicked_oldest' ELSE 'ok' END,
    'kicked_device', CASE WHEN v_active_count >= v_max_sessions THEN v_oldest_session.device_label ELSE NULL END
  );
END;
$$;

-- Function for heartbeat
CREATE OR REPLACE FUNCTION public.heartbeat_session(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE user_sessions
  SET last_heartbeat_at = now()
  WHERE session_token = p_session_token
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to check if current session is still valid
CREATE OR REPLACE FUNCTION public.is_session_valid(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_sessions
    WHERE session_token = p_session_token
    AND user_id = auth.uid()
  );
END;
$$;

-- Function to remove session on logout
CREATE OR REPLACE FUNCTION public.remove_session(p_session_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM user_sessions
  WHERE session_token = p_session_token
    AND user_id = auth.uid();
END;
$$;

-- Enable realtime for kicked-session detection
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
