-- Hindra att inloggade användare kan fråga om godtyckliga user/org-par är admin.
-- Alla nuvarande anrop sker antingen med auth.uid() (RLS-policyer) eller
-- utan session (service_role / edge functions / triggers), så beteendet är oförändrat.
CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id uuid, p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
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
  AND (
    auth.uid() IS NULL
    OR auth.uid() = p_user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles caller
      WHERE caller.user_id = auth.uid()
        AND caller.organization_id = p_organization_id
        AND caller.is_active = true
    )
  )
$function$;