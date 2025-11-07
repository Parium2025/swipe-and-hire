-- Ensure public bucket exists
insert into storage.buckets (id, name, public)
values ('job-images','job-images', true)
on conflict (id) do nothing;

-- Create policies idempotently using DO blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view job images'
  ) THEN
    CREATE POLICY "Public can view job images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'job-images');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own job images'
  ) THEN
    CREATE POLICY "Users can upload own job images"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'job-images'
        AND auth.role() = 'authenticated'
        AND (auth.uid()::text = (storage.foldername(name))[1])
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own job images'
  ) THEN
    CREATE POLICY "Users can update own job images"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'job-images'
        AND auth.role() = 'authenticated'
        AND (auth.uid()::text = (storage.foldername(name))[1])
      )
      WITH CHECK (
        bucket_id = 'job-images'
        AND auth.role() = 'authenticated'
        AND (auth.uid()::text = (storage.foldername(name))[1])
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own job images'
  ) THEN
    CREATE POLICY "Users can delete own job images"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'job-images'
        AND auth.role() = 'authenticated'
        AND (auth.uid()::text = (storage.foldername(name))[1])
      );
  END IF;
END$$;