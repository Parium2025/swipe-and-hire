DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Users can create their own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);