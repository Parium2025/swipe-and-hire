DROP POLICY IF EXISTS "Service role can manage queue" ON public.cv_analysis_queue;
CREATE POLICY "Service role can manage queue"
ON public.cv_analysis_queue
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all summaries" ON public.profile_cv_summaries;
CREATE POLICY "Service role can manage all summaries"
ON public.profile_cv_summaries
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all sessions" ON public.user_sessions;
CREATE POLICY "Service role can manage all sessions"
ON public.user_sessions
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

REVOKE USAGE ON SCHEMA graphql FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA graphql FROM anon;