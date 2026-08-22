CREATE OR REPLACE FUNCTION public.enforce_profile_view_permission_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_expiry timestamptz := now() + interval '12 months';
BEGIN
  IF NEW.expires_at IS NULL OR NEW.expires_at > max_expiry THEN
    NEW.expires_at := max_expiry;
  END IF;
  IF NEW.expires_at <= now() THEN
    NEW.expires_at := now() + interval '1 hour';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_view_permissions_expiry ON public.profile_view_permissions;
CREATE TRIGGER trg_profile_view_permissions_expiry
BEFORE INSERT OR UPDATE ON public.profile_view_permissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_view_permission_expiry();

UPDATE public.profile_view_permissions
SET expires_at = LEAST(COALESCE(expires_at, now() + interval '12 months'), now() + interval '12 months');