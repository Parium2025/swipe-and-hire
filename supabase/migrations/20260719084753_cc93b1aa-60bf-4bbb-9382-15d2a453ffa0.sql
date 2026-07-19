DROP POLICY IF EXISTS "Message participants can view attachments" ON storage.objects;

CREATE POLICY "Message participants can view attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (
    -- Ägaren av filen (uppladdaren) får alltid läsa
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Andra konversationsmedlemmar får läsa ENDAST om avsändaren av
    -- meddelandet också är den som laddade upp filen (folder = sender_id).
    -- Detta blockerar attacken där en medlem "forgar" attachment_url
    -- som pekar på någon annans privata fil.
    EXISTS (
      SELECT 1
      FROM public.conversation_messages cm
      JOIN public.conversation_members cmem
        ON cmem.conversation_id = cm.conversation_id
      WHERE cm.attachment_url LIKE '%' || storage.objects.name || '%'
        AND cmem.user_id = auth.uid()
        AND (storage.foldername(storage.objects.name))[1] = cm.sender_id::text
    )
  )
);