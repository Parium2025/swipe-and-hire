CREATE OR REPLACE FUNCTION public.fill_job_branding_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prof RECORD;
BEGIN
  -- Uppdateringar som kommer från ett namnbyte i profilen sätter redan rätt värden.
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  SELECT company_name, company_logo_url INTO prof
  FROM public.profiles WHERE user_id = NEW.employer_id;
  IF NULLIF(btrim(prof.company_name), '') IS NOT NULL THEN
    -- Bolagets namn och logga är alltid en och samma källa för alla annonser.
    NEW.workplace_name := btrim(prof.company_name);
    NEW.company_logo_url := prof.company_logo_url;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fill_job_branding_from_profile ON public.job_postings;
CREATE TRIGGER trg_fill_job_branding_from_profile
BEFORE INSERT OR UPDATE OF employer_id, workplace_name, company_logo_url ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.fill_job_branding_from_profile();

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
  -- Mallar följer bolagets namn så nya annonser aldrig får ett gammalt namn.
  UPDATE public.job_templates
     SET workplace_name = btrim(NEW.company_name)
   WHERE employer_id = NEW.user_id
     AND workplace_name IS DISTINCT FROM btrim(NEW.company_name);
  RETURN NEW;
END;
$$;

UPDATE public.job_templates t SET workplace_name = btrim(p.company_name)
FROM public.profiles p
WHERE p.user_id = t.employer_id AND NULLIF(btrim(p.company_name), '') IS NOT NULL
  AND t.workplace_name IS DISTINCT FROM btrim(p.company_name);