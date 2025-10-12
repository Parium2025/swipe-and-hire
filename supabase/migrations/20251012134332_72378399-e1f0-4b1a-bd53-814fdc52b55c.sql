-- Allow individual employers to manage their own job postings regardless of organization_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'job_postings' 
      AND policyname = 'Employers manage own job postings'
  ) THEN
    CREATE POLICY "Employers manage own job postings"
    ON public.job_postings
    FOR ALL
    USING (employer_id = auth.uid())
    WITH CHECK (employer_id = auth.uid());
  END IF;
END $$;