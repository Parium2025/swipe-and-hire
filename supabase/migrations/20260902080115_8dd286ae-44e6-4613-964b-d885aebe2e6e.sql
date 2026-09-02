CREATE OR REPLACE FUNCTION public.enforce_candidate_profile_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Serialisera profilskapande per användare så att två samtidiga INSERT-anrop
  -- inte båda kan passera count-kontrollen.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF (SELECT count(*) FROM public.candidate_profiles WHERE user_id = NEW.user_id) >= 2 THEN
    RAISE EXCEPTION 'Max 2 extra kandidatprofiler per anvandare';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_candidate_profile_limit() FROM PUBLIC, anon, authenticated;