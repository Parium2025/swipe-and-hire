CREATE OR REPLACE FUNCTION public.notify_colleague_candidate_shared()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _actor_name text;
  _cand_name text;
BEGIN
  IF _actor IS NULL OR _actor = NEW.recruiter_id THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.list_id IS NOT DISTINCT FROM OLD.list_id THEN
    RETURN NEW;
  END IF;

  -- Återställ kollegans oläst-prick för ansökan, oavsett tidigare öppning.
  IF NEW.application_id IS NOT NULL THEN
    DELETE FROM public.job_application_views
    WHERE viewer_id = NEW.recruiter_id AND application_id = NEW.application_id;
  END IF;

  SELECT trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) INTO _actor_name
  FROM public.profiles WHERE user_id = _actor;
  SELECT trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) INTO _cand_name
  FROM public.job_applications WHERE id = NEW.application_id;

  INSERT INTO public.notifications (user_id, type, title, body, metadata)
  VALUES (
    NEW.recruiter_id,
    'candidate_shared',
    'Ny kandidat i din lista',
    coalesce(nullif(_actor_name,''),'En kollega') || ' lade till ' || coalesce(nullif(_cand_name,''),'en kandidat') || ' i din lista.',
    jsonb_build_object(
      'application_id', NEW.application_id,
      'applicant_id', NEW.applicant_id,
      'shared_by', _actor,
      'route', CASE WHEN NEW.application_id IS NOT NULL THEN '?open_application=' || NEW.application_id::text ELSE '/my-candidates' END
    )
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_colleague_candidate_shared() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_colleague_candidate_shared ON public.my_candidates;
CREATE TRIGGER trg_notify_colleague_candidate_shared
AFTER INSERT OR UPDATE OF list_id ON public.my_candidates
FOR EACH ROW EXECUTE FUNCTION public.notify_colleague_candidate_shared();