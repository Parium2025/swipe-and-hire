DROP POLICY IF EXISTS "Senders can update their messages" ON public.conversation_messages;
CREATE POLICY "Senders can update their messages"
ON public.conversation_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (
  auth.uid() = sender_id
  AND conversation_id = (SELECT cm.conversation_id FROM public.conversation_messages cm WHERE cm.id = conversation_messages.id)
  AND sender_id = (SELECT cm.sender_id FROM public.conversation_messages cm WHERE cm.id = conversation_messages.id)
  AND created_at = (SELECT cm.created_at FROM public.conversation_messages cm WHERE cm.id = conversation_messages.id)
  AND attachment_url IS NOT DISTINCT FROM (SELECT cm.attachment_url FROM public.conversation_messages cm WHERE cm.id = conversation_messages.id)
  AND attachment_name IS NOT DISTINCT FROM (SELECT cm.attachment_name FROM public.conversation_messages cm WHERE cm.id = conversation_messages.id)
  AND attachment_type IS NOT DISTINCT FROM (SELECT cm.attachment_type FROM public.conversation_messages cm WHERE cm.id = conversation_messages.id)
);

DROP POLICY IF EXISTS "Admins can post admin replies" ON public.support_messages;
CREATE POLICY "Admins can post admin replies"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  AND COALESCE(is_admin_reply, false) = true
  AND EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = support_messages.ticket_id)
);