-- Allow conversation members to view each other's profiles
-- This is needed so that users can see who they are chatting with

CREATE POLICY "Conversation members can view each other profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = profiles.user_id
  )
);