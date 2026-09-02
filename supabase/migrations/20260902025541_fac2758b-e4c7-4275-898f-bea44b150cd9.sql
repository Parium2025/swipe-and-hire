CREATE OR REPLACE FUNCTION public.enforce_candidate_profile_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.candidate_profiles WHERE user_id = NEW.user_id) >= 2 THEN
    RAISE EXCEPTION 'Max 2 extra kandidatprofiler per anvandare';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_candidate_profile_limit() FROM PUBLIC, anon, authenticated;