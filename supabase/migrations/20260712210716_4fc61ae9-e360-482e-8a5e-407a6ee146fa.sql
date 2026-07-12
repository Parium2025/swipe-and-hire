DROP POLICY IF EXISTS "Users can create their own notifications" ON public.notifications;

CREATE POLICY "Users can insert own system-alert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND type = 'system_performance_alert'
);