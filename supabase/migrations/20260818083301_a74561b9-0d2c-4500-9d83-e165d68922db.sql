CREATE OR REPLACE FUNCTION public.move_candidates_before_list_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_id uuid;
BEGIN
  IF OLD.is_default THEN
    RETURN OLD;
  END IF;

  SELECT id INTO v_default_id
  FROM public.candidate_lists
  WHERE owner_id = OLD.owner_id AND is_default = true AND id <> OLD.id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_default_id IS NULL THEN
    SELECT id INTO v_default_id
    FROM public.candidate_lists
    WHERE owner_id = OLD.owner_id AND id <> OLD.id
    ORDER BY order_index ASC, created_at ASC
    LIMIT 1;
  END IF;

  IF v_default_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Flytta kandidaterna till standardlistan istället för att radera dem.
  -- Undvik krock med unik (recruiter_id, application_id): den finns redan per rad,
  -- så en enkel uppdatering av list_id är säker.
  UPDATE public.my_candidates mc
  SET list_id = v_default_id,
      stage = CASE
        WHEN mc.stage IN ('to_contact','interview','offer','hired') THEN mc.stage
        WHEN EXISTS (
          SELECT 1 FROM public.user_stage_settings uss
          WHERE uss.user_id = OLD.owner_id
            AND uss.list_id = v_default_id
            AND uss.stage_key = mc.stage
            AND COALESCE(uss.custom_label, '') <> '__DELETED__'
        ) THEN mc.stage
        ELSE 'to_contact'
      END,
      updated_at = now()
  WHERE mc.list_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_move_candidates_before_list_delete ON public.candidate_lists;
CREATE TRIGGER trg_move_candidates_before_list_delete
BEFORE DELETE ON public.candidate_lists
FOR EACH ROW
EXECUTE FUNCTION public.move_candidates_before_list_delete();