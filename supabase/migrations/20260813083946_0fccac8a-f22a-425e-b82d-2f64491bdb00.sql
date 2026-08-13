DROP POLICY IF EXISTS "Members can update their own membership" ON public.conversation_members;
CREATE POLICY "Members can update their own membership"
ON public.conversation_members
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);