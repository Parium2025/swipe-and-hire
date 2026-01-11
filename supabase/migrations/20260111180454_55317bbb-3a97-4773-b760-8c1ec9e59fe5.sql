-- Enable realtime for candidate_ratings and candidate_notes tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_notes;