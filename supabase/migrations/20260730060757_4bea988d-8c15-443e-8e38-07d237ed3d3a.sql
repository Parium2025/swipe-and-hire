DROP POLICY IF EXISTS "Admins can view all app exceptions" ON public.app_exceptions;

CREATE POLICY "Platform admins can view all app exceptions"
ON public.app_exceptions
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));