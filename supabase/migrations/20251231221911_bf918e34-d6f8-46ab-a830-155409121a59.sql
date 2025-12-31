-- Enable realtime for profiles table only (job_applications already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;