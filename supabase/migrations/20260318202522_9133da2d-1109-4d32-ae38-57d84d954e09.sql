-- Drop the old storage policy that references the legacy messages table
DROP POLICY IF EXISTS "Message participants can view attachments" ON storage.objects;

-- Recreate it using conversation_messages instead
CREATE POLICY "Message participants can view attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.conversation_messages cm
      JOIN public.conversation_members cmem ON cmem.conversation_id = cm.conversation_id
      WHERE cm.attachment_url LIKE ('%' || objects.name || '%')
        AND cmem.user_id = auth.uid()
    )
  )
);

-- Now safely drop the legacy tables (message_reactions has FK to messages, so drop first)
DROP TABLE IF EXISTS public.message_reactions;
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.link_previews;