DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'job_questions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.job_questions';
  END IF;
END $$;

ALTER TABLE public.job_questions REPLICA IDENTITY FULL;
ALTER TABLE public.job_postings REPLICA IDENTITY FULL;