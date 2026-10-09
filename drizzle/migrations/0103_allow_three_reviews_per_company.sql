CREATE OR REPLACE FUNCTION public.enforce_max_three_reviews_per_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid := coalesce(NEW.hidden_author_id, NEW.user_id);
  _count integer;
BEGIN
  IF _author IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.company_id::text || ':' || _author::text, 0));
  SELECT count(*) INTO _count
  FROM public.company_reviews
  WHERE company_id = NEW.company_id
    AND coalesce(hidden_author_id, user_id) = _author;
  IF _count >= 3 THEN
    RAISE EXCEPTION 'max_three_reviews' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER trg_zz_one_review_per_company ON public.company_reviews;

CREATE TRIGGER trg_zz_max_three_reviews_per_company
BEFORE INSERT ON public.company_reviews
FOR EACH ROW
EXECUTE FUNCTION public.enforce_max_three_reviews_per_company();