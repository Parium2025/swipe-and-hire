CREATE OR REPLACE FUNCTION public.sync_applicant_list_siblings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.list_id IS DISTINCT FROM OLD.list_id AND NEW.list_id IS NOT NULL THEN
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
$function$;