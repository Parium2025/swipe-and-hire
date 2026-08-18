-- Support: platform admins need read access to be able to reply
CREATE POLICY "Platform admins can view all tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can view all support messages"
ON public.support_messages
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- user_roles: block org admins from minting global platform admins
DROP POLICY IF EXISTS "Admins can insert to user_roles" ON public.user_roles;
CREATE POLICY "Admins can insert to user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND public.is_org_admin(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "Admins can update user_roles in their org" ON public.user_roles;
CREATE POLICY "Admins can update user_roles in their org"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.is_org_admin(auth.uid(), organization_id)
)
WITH CHECK (
  organization_id IS NOT NULL
  AND public.is_org_admin(auth.uid(), organization_id)
);
