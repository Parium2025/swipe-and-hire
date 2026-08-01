DROP POLICY IF EXISTS "Message participants can view attachments" ON storage.objects;

CREATE POLICY "Message participants can view attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.conversation_members cmem
      WHERE cmem.user_id = auth.uid()
        AND (storage.foldername(objects.name))[2] IS NOT NULL
        AND (storage.foldername(objects.name))[2] ~ '^[0-9a-fA-F-]{36}$'
        AND cmem.conversation_id = ((storage.foldername(objects.name))[2])::uuid
    )
  )
);