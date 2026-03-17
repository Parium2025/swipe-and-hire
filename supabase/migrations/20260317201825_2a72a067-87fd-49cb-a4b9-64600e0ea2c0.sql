
-- 1. Add attachment columns to conversation_messages
ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- 2. Create reactions table for conversation messages
CREATE TABLE IF NOT EXISTS public.conversation_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- 3. Enable RLS
ALTER TABLE public.conversation_message_reactions ENABLE ROW LEVEL SECURITY;

-- 4. RLS: Users can view reactions on messages in conversations they belong to
CREATE POLICY "Members can view reactions"
ON public.conversation_message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_messages cm
    JOIN public.conversation_members mem ON mem.conversation_id = cm.conversation_id
    WHERE cm.id = conversation_message_reactions.message_id
    AND mem.user_id = auth.uid()
  )
);

-- 5. RLS: Users can add reactions to messages in their conversations
CREATE POLICY "Members can add reactions"
ON public.conversation_message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.conversation_messages cm
    JOIN public.conversation_members mem ON mem.conversation_id = cm.conversation_id
    WHERE cm.id = conversation_message_reactions.message_id
    AND mem.user_id = auth.uid()
  )
);

-- 6. RLS: Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
ON public.conversation_message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 7. Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage RLS: Members of a conversation can upload attachments
CREATE POLICY "Authenticated users can upload message attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

-- 9. Storage RLS: Members can view attachments
CREATE POLICY "Authenticated users can view message attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'message-attachments');

-- 10. Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_message_reactions;
