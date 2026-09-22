-- Serversidig spärr för gratisplanens gräns på 3 sparade jobb.
-- Gäller bara när användaren själv skriver (auth.uid() = user_id); interna
-- service-role-jobb och migreringar påverkas inte.
CREATE OR REPLACE FUNCTION public.enforce_saved_jobs_free_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_premium boolean;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(is_premium, false) OR (premium_until IS NOT NULL AND premium_until > now())
    INTO v_is_premium
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF COALESCE(v_is_premium, false) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM public.saved_jobs WHERE user_id = NEW.user_id;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'saved_jobs_free_limit_reached'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_saved_jobs_free_limit ON public.saved_jobs;
CREATE TRIGGER enforce_saved_jobs_free_limit
BEFORE INSERT ON public.saved_jobs
FOR EACH ROW EXECUTE FUNCTION public.enforce_saved_jobs_free_limit();