CREATE POLICY "Creators can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = created_by);