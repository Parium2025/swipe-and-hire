-- Enable realtime for job_postings table
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_postings;

-- Ensure full row data is captured for realtime updates
ALTER TABLE public.job_postings REPLICA IDENTITY FULL;