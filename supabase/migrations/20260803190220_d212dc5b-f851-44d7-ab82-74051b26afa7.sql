DROP POLICY IF EXISTS "authenticated_can_receive_own_broadcasts" ON realtime.messages;

CREATE POLICY "authenticated_can_receive_own_broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'typing-%'
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.conversation_id::text = substring(realtime.topic() from 8)
    )
  )
);