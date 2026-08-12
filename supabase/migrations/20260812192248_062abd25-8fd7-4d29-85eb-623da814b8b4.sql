DROP POLICY IF EXISTS "Users can upload message attachments" ON storage.objects;

CREATE POLICY "Users can upload message attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] IS NOT NULL
  AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.conversation_members cmem
    WHERE cmem.user_id = auth.uid()
      AND cmem.conversation_id = ((storage.foldername(name))[2])::uuid
  )
);