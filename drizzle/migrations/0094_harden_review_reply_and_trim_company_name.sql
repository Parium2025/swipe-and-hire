CREATE OR REPLACE FUNCTION public.guard_company_review_reply()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Only the security-definer reply function (runs as owner) may write reply columns.
  IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.employer_reply := NULL; NEW.employer_reply_at := NULL; NEW.employer_reply_by := NULL;
    ELSE
      NEW.employer_reply := OLD.employer_reply;
      NEW.employer_reply_at := OLD.employer_reply_at;
      NEW.employer_reply_by := OLD.employer_reply_by;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_company_review_reply ON public.company_reviews;
CREATE TRIGGER trg_guard_company_review_reply BEFORE INSERT OR UPDATE ON public.company_reviews
FOR EACH ROW EXECUTE FUNCTION public.guard_company_review_reply();

REVOKE EXECUTE ON FUNCTION public.reply_to_company_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_company_review(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.trim_profile_company_name()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.company_name IS NOT NULL THEN NEW.company_name := btrim(NEW.company_name); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ab_trim_profile_company_name ON public.profiles;
CREATE TRIGGER ab_trim_profile_company_name BEFORE INSERT OR UPDATE OF company_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trim_profile_company_name();

UPDATE public.profiles SET company_name = btrim(company_name)
WHERE company_name IS NOT NULL AND company_name <> btrim(company_name);