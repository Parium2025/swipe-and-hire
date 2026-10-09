CREATE OR REPLACE FUNCTION public.edit_company_review_message(_message_id uuid, _body text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _company uuid; _org uuid; _b text := btrim(coalesce(_body, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _b = '' THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF char_length(_b) > 1000 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  SELECT r.company_id INTO _company FROM public.company_review_messages m
    JOIN public.company_reviews r ON r.id = m.review_id
    WHERE m.id = _message_id AND m.author_kind = 'company';
  IF _company IS NULL THEN RETURN false; END IF;
  SELECT organization_id INTO _org FROM public.profiles WHERE user_id = _company;
  IF NOT ((_org IS NULL AND auth.uid() = _company) OR (_org IS NOT NULL AND public.is_org_admin(auth.uid(), _org))) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE public.company_review_messages SET body = _b WHERE id = _message_id;
  RETURN FOUND;
END $function$;
REVOKE ALL ON FUNCTION public.edit_company_review_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_company_review_message(uuid, text) TO authenticated;