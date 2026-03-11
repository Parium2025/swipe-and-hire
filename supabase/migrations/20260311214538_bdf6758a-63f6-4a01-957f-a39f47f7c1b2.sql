-- Tighten conversation member insertion to prevent self-joining arbitrary conversations
DROP POLICY IF EXISTS "Conversation admins can add members" ON public.conversation_members;

CREATE POLICY "Conversation admins can add members"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_members.conversation_id
        AND c.created_by = auth.uid()
    )
  )
  OR public.is_conversation_admin(conversation_id)
);