-- Adjust storage policy to avoid foldername() and use split_part for path prefix check
DROP POLICY IF EXISTS "Authenticated can upload to job-applications own folder" ON storage.objects;

CREATE POLICY "Auth can upload to job-applications under own uid prefix"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-applications'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.validate_file_upload_secure(
    name,
    COALESCE((metadata->>'size')::bigint, 0),
    COALESCE(metadata->>'mimetype', 'application/octet-stream')
  )
);
