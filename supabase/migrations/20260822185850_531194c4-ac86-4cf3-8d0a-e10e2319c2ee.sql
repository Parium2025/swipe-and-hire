DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'account_deletion_queue'
      AND policyname = 'No direct user access'
  ) THEN
    CREATE POLICY "No direct user access"
      ON public.account_deletion_queue
      FOR ALL TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;