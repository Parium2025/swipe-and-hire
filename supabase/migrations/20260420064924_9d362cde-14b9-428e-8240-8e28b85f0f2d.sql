-- Auto-sync company branding from profile to all job postings
CREATE OR REPLACE FUNCTION public.sync_jobs_branding_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.company_name IS DISTINCT FROM OLD.company_name)
     OR (NEW.company_logo_url IS DISTINCT FROM OLD.company_logo_url) THEN
    UPDATE public.job_postings
    SET workplace_name = NEW.company_name,
        company_logo_url = NEW.company_logo_url,
        updated_at = now()
    WHERE employer_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_jobs_branding_from_profile ON public.profiles;
CREATE TRIGGER trg_sync_jobs_branding_from_profile
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_jobs_branding_from_profile();

-- Auto-fill branding on new job postings from profile
CREATE OR REPLACE FUNCTION public.fill_job_branding_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof RECORD;
BEGIN
  SELECT company_name, company_logo_url INTO prof
  FROM public.profiles WHERE user_id = NEW.employer_id;

  IF prof.company_name IS NOT NULL THEN
    NEW.workplace_name := COALESCE(NULLIF(NEW.workplace_name, ''), prof.company_name);
    -- Always force logo to match profile (single source of truth)
    NEW.company_logo_url := prof.company_logo_url;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_job_branding_from_profile ON public.job_postings;
CREATE TRIGGER trg_fill_job_branding_from_profile
BEFORE INSERT OR UPDATE OF employer_id ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.fill_job_branding_from_profile();