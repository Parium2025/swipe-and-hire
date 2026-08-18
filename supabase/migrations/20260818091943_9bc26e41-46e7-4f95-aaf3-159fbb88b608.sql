-- Log stage changes on my_candidates (kanban drag, bulk move, dialog)
CREATE OR REPLACE FUNCTION public.log_my_candidate_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.candidate_activities (applicant_id, user_id, activity_type, old_value, new_value, metadata)
    VALUES (
      NEW.applicant_id,
      COALESCE(auth.uid(), NEW.recruiter_id),
      'stage_changed',
      OLD.stage,
      NEW.stage,
      jsonb_build_object('my_candidate_id', NEW.id, 'job_id', NEW.job_id, 'list_id', NEW.list_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_my_candidate_stage_change ON public.my_candidates;
CREATE TRIGGER trg_log_my_candidate_stage_change
AFTER UPDATE ON public.my_candidates
FOR EACH ROW EXECUTE FUNCTION public.log_my_candidate_stage_change();

-- Log rating changes from the persistent ratings table (single source of truth)
CREATE OR REPLACE FUNCTION public.log_candidate_rating_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.rating IS NOT DISTINCT FROM OLD.rating THEN
    RETURN NEW;
  END IF;

  v_old := CASE WHEN TG_OP = 'UPDATE' THEN OLD.rating::text ELSE '0' END;

  -- Avoid duplicates when several code paths write the same rating in quick succession
  IF EXISTS (
    SELECT 1 FROM public.candidate_activities ca
    WHERE ca.applicant_id = NEW.applicant_id
      AND ca.user_id = COALESCE(auth.uid(), NEW.recruiter_id)
      AND ca.activity_type = 'rating_changed'
      AND ca.new_value = NEW.rating::text
      AND ca.created_at > now() - interval '10 seconds'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.candidate_activities (applicant_id, user_id, activity_type, old_value, new_value, metadata)
  VALUES (
    NEW.applicant_id,
    COALESCE(auth.uid(), NEW.recruiter_id),
    'rating_changed',
    v_old,
    NEW.rating::text,
    jsonb_build_object('source', 'candidate_ratings')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_candidate_rating_change ON public.candidate_ratings;
CREATE TRIGGER trg_log_candidate_rating_change
AFTER INSERT OR UPDATE ON public.candidate_ratings
FOR EACH ROW EXECUTE FUNCTION public.log_candidate_rating_change();