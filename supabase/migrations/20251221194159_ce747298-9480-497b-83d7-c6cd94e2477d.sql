-- Ensure realtime payloads include recruiter_id for UPDATE/DELETE filter matching
ALTER TABLE public.my_candidates REPLICA IDENTITY FULL;