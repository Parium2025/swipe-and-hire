ALTER TABLE public.conversation_messages
ADD COLUMN sender_identity text NOT NULL DEFAULT 'person'
CHECK (sender_identity IN ('person', 'company'));

COMMENT ON COLUMN public.conversation_messages.sender_identity IS
  'Presentation identity: person for manually authored messages, company for automated company messages.';

UPDATE public.conversation_messages AS message
SET sender_identity = 'company'
WHERE EXISTS (
  SELECT 1
  FROM public.outreach_dispatch_logs AS dispatch
  WHERE dispatch.channel = 'chat'
    AND dispatch.status = 'sent'
    AND dispatch.trigger <> 'manual_send'
    AND dispatch.conversation_id = message.conversation_id
    AND dispatch.owner_user_id = message.sender_id
    AND dispatch.sent_at BETWEEN message.created_at AND message.created_at + interval '10 seconds'
);

UPDATE public.conversation_messages AS message
SET sender_identity = 'company'
WHERE message.sender_identity = 'person'
  AND message.content LIKE 'Hej! Tjänsten "%" hos % har nu avslutats.%'
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS sender
    WHERE sender.user_id = message.sender_id
      AND sender.role = 'employer'
  );

CREATE INDEX idx_conversation_messages_company_identity
ON public.conversation_messages (conversation_id, created_at DESC)
WHERE sender_identity = 'company';