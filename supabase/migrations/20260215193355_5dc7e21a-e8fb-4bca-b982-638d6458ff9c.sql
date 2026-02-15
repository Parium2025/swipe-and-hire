-- Enable REPLICA IDENTITY FULL so Realtime DELETE events include all columns
-- (specifically session_token, which the client needs to detect being kicked)
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;