-- Ensure realtime DELETE/UPDATE payloads include user_id so filtered subscriptions (user_id=eq.<id>) fire
-- This fixes sidebar counters not updating when a saved job is removed.
ALTER TABLE public.saved_jobs REPLICA IDENTITY FULL;