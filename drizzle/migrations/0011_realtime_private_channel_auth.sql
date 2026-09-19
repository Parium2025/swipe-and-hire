-- Skydda broadcast/presence-kanaler med Realtime Authorization.
-- Kanalerna blir privata i klienten (config.private = true) och kräver
-- policy-träff på realtime.messages för både lyssning (SELECT) och
-- sändning (INSERT). Tillåtna topics:
--   1. user:<uid>[:...]        – användarens egna kanaler (t.ex. notis-sync
--                                mellan enheter). Klientens kanalfabrik lägger
--                                på suffix ":<runtime>:<instans>", därför LIKE.
--   2. typing-<conversationId> – skrivindikator/närvaro, endast för medlemmar
--                                i konversationen.

DROP POLICY IF EXISTS "authenticated_can_receive_own_broadcasts" ON realtime.messages;

CREATE POLICY "authenticated_can_receive_own_broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
  OR realtime.topic() = 'user:' || auth.uid()::text
  OR (
    realtime.topic() LIKE 'typing-%'
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.conversation_id::text = substring(realtime.topic() from 8)
    )
  )
);

DROP POLICY IF EXISTS "authenticated_can_send_own_broadcasts" ON realtime.messages;

CREATE POLICY "authenticated_can_send_own_broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
  OR realtime.topic() = 'user:' || auth.uid()::text
  OR (
    realtime.topic() LIKE 'typing-%'
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.conversation_id::text = substring(realtime.topic() from 8)
    )
  )
);