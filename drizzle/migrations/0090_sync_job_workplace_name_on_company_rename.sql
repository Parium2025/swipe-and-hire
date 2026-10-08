CREATE OR REPLACE FUNCTION public.sync_job_workplace_name_on_company_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NULLIF(btrim(NEW.company_name), '') IS NULL
     OR btrim(COALESCE(OLD.company_name, '')) = btrim(NEW.company_name) THEN
    RETURN NEW;
  END IF;
  UPDATE public.job_postings
     SET workplace_name = btrim(NEW.company_name)
   WHERE employer_id = NEW.user_id
     AND (NULLIF(btrim(workplace_name), '') IS NULL
          OR btrim(workplace_name) = btrim(COALESCE(OLD.company_name, '')));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_workplace_name_on_company_rename ON public.profiles;
CREATE TRIGGER trg_sync_job_workplace_name_on_company_rename
AFTER UPDATE OF company_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_job_workplace_name_on_company_rename();