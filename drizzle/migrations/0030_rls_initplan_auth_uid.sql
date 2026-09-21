-- Prestanda: auth.uid() utan (select ...) körs om för VARJE rad som policyn
-- prövas mot. Med (select auth.uid()) beräknas värdet en gång per fråga.
-- Identisk behörighet, men märkbart billigare när tabellerna växer.
DROP POLICY IF EXISTS "Viewers read own application views" ON public.job_application_views;
CREATE POLICY "Viewers read own application views"
ON public.job_application_views
FOR SELECT
TO authenticated
USING (viewer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Viewers insert own application views" ON public.job_application_views;
CREATE POLICY "Viewers insert own application views"
ON public.job_application_views
FOR INSERT
TO authenticated
WITH CHECK ((viewer_id = (SELECT auth.uid())) AND can_view_job_application(application_id));

DROP POLICY IF EXISTS "Recipients can view decision reminder state" ON public.application_decision_reminder_state;
CREATE POLICY "Recipients can view decision reminder state"
ON public.application_decision_reminder_state
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = recipient_user_id);

DROP POLICY IF EXISTS "Recipients can update decision reminder state" ON public.application_decision_reminder_state;
CREATE POLICY "Recipients can update decision reminder state"
ON public.application_decision_reminder_state
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = recipient_user_id)
WITH CHECK ((SELECT auth.uid()) = recipient_user_id);

DROP POLICY IF EXISTS "Users can view their own digest state" ON public.notification_digest_state;
CREATE POLICY "Users can view their own digest state"
ON public.notification_digest_state
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);