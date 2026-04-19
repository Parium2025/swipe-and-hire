-- Trigger function: when company_name changes on a profile, sync workplace_name on all that employer's job_postings
CREATE OR REPLACE FUNCTION public.sync_company_name_to_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act if company_name actually changed and is non-empty
  IF NEW.company_name IS DISTINCT FROM OLD.company_name
     AND NEW.company_name IS NOT NULL
     AND length(trim(NEW.company_name)) > 0 THEN

    UPDATE public.job_postings
    SET workplace_name = NEW.company_name,
        updated_at = now()
    WHERE employer_id = NEW.user_id
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_company_name_to_jobs_trigger ON public.profiles;

CREATE TRIGGER sync_company_name_to_jobs_trigger
AFTER UPDATE OF company_name ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_name_to_jobs();