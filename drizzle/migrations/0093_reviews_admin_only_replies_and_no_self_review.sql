CREATE OR REPLACE FUNCTION public.reply_to_company_review(_review_id uuid, _reply text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _company_org uuid;
  _trimmed text := nullif(btrim(_reply), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT company_id INTO _company_id FROM public.company_reviews WHERE id = _review_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'review_not_found';
  END IF;
  SELECT organization_id INTO _company_org FROM public.profiles WHERE user_id = _company_id;
  -- Endast bolagets admin får svara; rekryterare kan läsa men inte svara.
  IF NOT (
    (_company_org IS NULL AND auth.uid() = _company_id)
    OR (_company_org IS NOT NULL AND public.is_org_admin(auth.uid(), _company_org))
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _trimmed IS NOT NULL AND char_length(_trimmed) > 1000 THEN
    RAISE EXCEPTION 'reply_too_long';
  END IF;
  UPDATE public.company_reviews
  SET employer_reply = _trimmed,
      employer_reply_at = CASE WHEN _trimmed IS NULL THEN NULL ELSE now() END,
      employer_reply_by = CASE WHEN _trimmed IS NULL THEN NULL ELSE auth.uid() END
  WHERE id = _review_id;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.normalize_company_review_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.company_id := public.company_owner_id(NEW.company_id);
  -- Ingen i bolaget kan recensera sitt eget bolag.
  IF TG_OP = 'INSERT' AND public.company_owner_id(NEW.user_id) = NEW.company_id THEN
    RAISE EXCEPTION 'cannot_review_own_company' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;