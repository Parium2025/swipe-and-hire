-- Enable realtime for candidate_evaluations table to get instant updates when AI evaluation completes
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_evaluations;