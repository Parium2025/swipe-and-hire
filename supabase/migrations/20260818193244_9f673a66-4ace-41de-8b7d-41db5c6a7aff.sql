
-- Explicit list choice must win over an existing sibling list.
CREATE OR REPLACE FUNCTION public.set_my_candidate_default_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sibling_list uuid;
BEGIN
  IF NEW.list_id IS NULL THEN
    SELECT mc.list_id INTO sibling_list
    FROM public.my_candidates mc
    WHERE mc.recruiter_id = NEW.recruiter_id
      AND mc.applicant_id = NEW.applicant_id
      AND mc.list_id IS NOT NULL
    ORDER BY mc.created_at DESC
    LIMIT 1;

    IF sibling_list IS NOT NULL THEN
      NEW.list_id := sibling_list;
    ELSE
      NEW.list_id := public.ensure_default_candidate_list(NEW.recruiter_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- No longer override an explicitly chosen list on insert.
CREATE OR REPLACE FUNCTION public.enforce_single_list_per_applicant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- After insert: pull all sibling rows for the same applicant into the chosen list.
CREATE OR REPLACE FUNCTION public.sync_applicant_list_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.list_id IS NOT NULL THEN
    UPDATE public.my_candidates
    SET list_id = NEW.list_id,
        stage = NEW.stage,
        updated_at = now()
    WHERE recruiter_id = NEW.recruiter_id
      AND applicant_id = NEW.applicant_id
      AND id <> NEW.id
      AND (list_id IS DISTINCT FROM NEW.list_id OR stage IS DISTINCT FROM NEW.stage);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_my_candidates_sync_after_insert ON public.my_candidates;
CREATE TRIGGER trg_my_candidates_sync_after_insert
AFTER INSERT ON public.my_candidates
FOR EACH ROW EXECUTE FUNCTION public.sync_applicant_list_after_insert();
