-- Fix RLS infinite recursion for conversation_members by using SECURITY DEFINER helpers

-- Helper: is current user a member of the conversation?
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

-- Helper: is current user an admin of the conversation?
CREATE OR REPLACE FUNCTION public.is_conversation_admin(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
      and cm.is_admin = true
  );
$$;

-- Lock down direct execution (still usable from RLS)
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_conversation_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_admin(uuid) TO authenticated;

-- Replace policies on conversation_members (old ones self-referenced and caused recursion)
DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Conversation admins can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can update their own membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;

CREATE POLICY "Users can view conversation members"
ON public.conversation_members
FOR SELECT
USING (public.is_conversation_member(conversation_id));

CREATE POLICY "Conversation admins can add members"
ON public.conversation_members
FOR INSERT
WITH CHECK (
  (user_id = auth.uid())
  OR public.is_conversation_admin(conversation_id)
);

CREATE POLICY "Members can update their own membership"
ON public.conversation_members
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can remove members"
ON public.conversation_members
FOR DELETE
USING (
  (user_id = auth.uid())
  OR public.is_conversation_admin(conversation_id)
);
