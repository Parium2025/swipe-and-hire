CREATE OR REPLACE FUNCTION public.guard_global_platform_admin_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.role::text = 'admin' AND NEW.organization_id IS NULL AND COALESCE(NEW.is_active, true) = true THEN
    SELECT lower(email)
      INTO v_email
      FROM auth.users
     WHERE id = NEW.user_id;

    IF v_email IS DISTINCT FROM 'pariumab@hotmail.com' THEN
      RAISE EXCEPTION 'Only the platform owner may hold the global admin role';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_global_platform_admin_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_global_platform_admin_owner() TO service_role;

DROP TRIGGER IF EXISTS guard_global_platform_admin_owner_trigger ON public.user_roles;
CREATE TRIGGER guard_global_platform_admin_owner_trigger
BEFORE INSERT OR UPDATE OF role, organization_id, is_active, user_id ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.guard_global_platform_admin_owner();

CREATE UNIQUE INDEX IF NOT EXISTS one_active_global_platform_admin
ON public.user_roles ((1))
WHERE role::text = 'admin'
  AND organization_id IS NULL
  AND COALESCE(is_active, true) = true;