CREATE OR REPLACE FUNCTION public.enforce_one_review_per_company()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _author uuid := coalesce(NEW.hidden_author_id, NEW.user_id);
BEGIN
  IF _author IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text || ':' || _author::text, 0));
  IF EXISTS (SELECT 1 FROM public.company_reviews
             WHERE company_id = NEW.company_id
               AND coalesce(hidden_author_id, user_id) = _author) THEN
    RAISE EXCEPTION 'already_reviewed' USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_zz_one_review_per_company ON public.company_reviews;
CREATE TRIGGER trg_zz_one_review_per_company BEFORE INSERT ON public.company_reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_one_review_per_company();