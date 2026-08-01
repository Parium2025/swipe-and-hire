CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id uuid, p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND role = 'admin'
      AND is_active = true
  )
$function$;

REVOKE ALL ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_admin(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;
CREATE POLICY "Admins can update their organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.is_org_admin(auth.uid(), id))
WITH CHECK (public.is_org_admin(auth.uid(), id));

DROP POLICY IF EXISTS "Admins can delete user_roles in their org" ON public.user_roles;
CREATE POLICY "Admins can delete user_roles in their org"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  AND user_id <> auth.uid()
);

DROP POLICY IF EXISTS "Admins can insert to user_roles" ON public.user_roles;
CREATE POLICY "Admins can insert to user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Admins can update user_roles in their org" ON public.user_roles;
CREATE POLICY "Admins can update user_roles in their org"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

DROP FUNCTION public.is_org_admin(uuid);