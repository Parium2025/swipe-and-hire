DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;

CREATE POLICY "Users can view conversation members"
ON public.conversation_members
FOR SELECT
TO authenticated
USING (
  public.is_conversation_member(conversation_id)
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_members.conversation_id
      AND c.created_by = (SELECT auth.uid())
  )
);