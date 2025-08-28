-- Relax insert policy to ensure uploads work; keep validation in trigger
DROP POLICY IF EXISTS "Auth can upload to job-applications under own uid prefix" ON storage.objects;

CREATE POLICY "Authenticated can upload to job-applications (bucket-level)"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-applications'
);

-- Trigger continues to sanitize and validate
DROP TRIGGER IF EXISTS sanitize_filename_trigger ON storage.objects;
CREATE TRIGGER sanitize_filename_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'job-applications')
  EXECUTE FUNCTION public.sanitize_storage_filename();