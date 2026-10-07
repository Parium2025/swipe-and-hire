CREATE OR REPLACE FUNCTION public.protect_welcome_completion_state()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.onboarding_completed IS TRUE AND NEW.onboarding_completed IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'Completed welcome cannot be reopened' USING ERRCODE='42501';
 END IF;
 IF current_user IN ('authenticated','anon') THEN
  IF TG_OP='INSERT' THEN
   IF NEW.onboarding_completed IS TRUE THEN RAISE EXCEPTION 'Use the atomic welcome completion flow' USING ERRCODE='42501'; END IF;
  ELSIF NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed THEN
   RAISE EXCEPTION 'Use the atomic welcome completion flow' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER protect_welcome_completion_state BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_welcome_completion_state();
COMMENT ON FUNCTION public.protect_welcome_completion_state() IS 'Invoker trigger: direct client writes cannot bypass atomic completion; completed guides cannot be reset. Ordinary later profile edits remain allowed.';