-- 1. Duplicate insert-log trigger (two triggers on the same function) → duplicate activities
DROP TRIGGER IF EXISTS on_my_candidate_added ON public.my_candidates;

-- 2. En kandidat (person) kan bara ligga i EN lista, även om personen sökt flera jobb
CREATE OR REPLACE FUNCTION public.enforce_single_list_per_applicant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sibling_list uuid;
BEGIN
  SELECT mc.list_id INTO sibling_list
  FROM public.my_candidates mc
  WHERE mc.recruiter_id = NEW.recruiter_id
    AND mc.applicant_id = NEW.applicant_id
    AND mc.id <> NEW.id
    AND mc.list_id IS NOT NULL
  ORDER BY mc.created_at DESC
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    IF sibling_list IS NOT NULL THEN
      NEW.list_id := sibling_list;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_applicant_list_siblings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.list_id IS DISTINCT FROM OLD.list_id AND NEW.list_id IS NOT NULL THEN
    UPDATE public.my_candidates
    SET list_id = NEW.list_id
    WHERE recruiter_id = NEW.recruiter_id
      AND applicant_id = NEW.applicant_id
      AND id <> NEW.id
      AND list_id IS DISTINCT FROM NEW.list_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_my_candidates_single_list ON public.my_candidates;
CREATE TRIGGER trg_my_candidates_single_list
  BEFORE INSERT ON public.my_candidates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_list_per_applicant();

DROP TRIGGER IF EXISTS trg_my_candidates_sync_siblings ON public.my_candidates;
CREATE TRIGGER trg_my_candidates_sync_siblings
  AFTER UPDATE OF list_id ON public.my_candidates
  FOR EACH ROW EXECUTE FUNCTION public.sync_applicant_list_siblings();

-- 3. Backfill: samla ihop redan splittrade kandidater till senaste listan
WITH latest AS (
  SELECT DISTINCT ON (recruiter_id, applicant_id)
    recruiter_id, applicant_id, list_id
  FROM public.my_candidates
  WHERE list_id IS NOT NULL
  ORDER BY recruiter_id, applicant_id, created_at DESC
)
UPDATE public.my_candidates mc
SET list_id = l.list_id
FROM latest l
WHERE mc.recruiter_id = l.recruiter_id
  AND mc.applicant_id = l.applicant_id
  AND mc.list_id IS DISTINCT FROM l.list_id;