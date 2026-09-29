CREATE OR REPLACE FUNCTION public.emit_profile_change_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.first_name IS NOT DISTINCT FROM OLD.first_name
     AND NEW.last_name IS NOT DISTINCT FROM OLD.last_name
     AND NEW.company_name IS NOT DISTINCT FROM OLD.company_name
     AND NEW.profile_image_url IS NOT DISTINCT FROM OLD.profile_image_url
     AND NEW.company_logo_url IS NOT DISTINCT FROM OLD.company_logo_url THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profile_change_signals AS signal (profile_user_id, revision, changed_at)
  VALUES (NEW.user_id, 1, now())
  ON CONFLICT (profile_user_id) DO UPDATE
    SET revision = signal.revision + 1,
        changed_at = EXCLUDED.changed_at;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.emit_profile_change_signal() FROM authenticated, anon, PUBLIC;

DROP TRIGGER IF EXISTS trg_emit_profile_change_signal ON public.profiles;
CREATE TRIGGER trg_emit_profile_change_signal
AFTER UPDATE OF first_name, last_name, company_name, profile_image_url, company_logo_url
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.emit_profile_change_signal();

GRANT SELECT ON public.profile_change_signals TO authenticated;
GRANT ALL ON public.profile_change_signals TO service_role;