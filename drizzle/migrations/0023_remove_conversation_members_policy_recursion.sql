CREATE OR REPLACE FUNCTION public.is_conversation_creator(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.created_by = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_creator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_creator(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
CREATE POLICY "Users can view conversation members"
ON public.conversation_members
FOR SELECT
TO authenticated
USING (
  public.is_conversation_member(conversation_id)
  OR public.is_conversation_creator(conversation_id)
);

DROP POLICY IF EXISTS "Conversation admins can add members" ON public.conversation_members;
CREATE POLICY "Conversation admins can add members"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  (
    user_id = (SELECT auth.uid())
    AND public.is_conversation_creator(conversation_id)
  )
  OR (
    public.is_conversation_admin(conversation_id)
    AND public.can_add_conversation_member(conversation_id, user_id)
  )
);