DROP POLICY IF EXISTS "Anyone can view rss health" ON public.rss_source_health;
CREATE POLICY "Admins can view rss health"
ON public.rss_source_health
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));
REVOKE SELECT ON public.rss_source_health FROM anon;