-- Fix storage RLS so authenticated users can upload videos to their own folder

-- 1) Drop potentially conflicting policy created earlier
DROP POLICY IF EXISTS "Users can upload job-related files" ON storage.objects;

-- 2) Create explicit authenticated upload policy scoped to user's folder and our secure validator
CREATE POLICY "Authenticated can upload to job-applications own folder" 
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-applications'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.validate_file_upload_secure(
    name,
    COALESCE((metadata->>'size')::bigint, 0),
    COALESCE(metadata->>'mimetype', 'application/octet-stream')
  )
);

-- 3) Ensure our filename sanitization trigger remains in place for this bucket
DROP TRIGGER IF EXISTS sanitize_filename_trigger ON storage.objects;
CREATE TRIGGER sanitize_filename_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'job-applications')
  EXECUTE FUNCTION public.sanitize_storage_filename();