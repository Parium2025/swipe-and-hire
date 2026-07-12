-- Fix 1: Storage INSERT ownership check on public buckets
DROP POLICY IF EXISTS "Authenticated users can upload to public buckets" ON storage.objects;

CREATE POLICY "Authenticated users can upload to their own folder in public buckets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('company-logos', 'job-images')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix 2: Realtime broadcast topic scoping
-- Only allow authenticated users to receive broadcasts on topics they own
-- (topic format assumed to be prefixed with user id, e.g. "user:<uid>:..." or "conv:<uid>:...")
DROP POLICY IF EXISTS "authenticated_can_receive_broadcasts" ON realtime.messages;

CREATE POLICY "authenticated_can_receive_own_broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow if topic contains the user's own uid
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);