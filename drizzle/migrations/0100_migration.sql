CREATE OR REPLACE FUNCTION public.delete_company_review_message(_message_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _company uuid; _org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT r.company_id INTO _company FROM public.company_review_messages m
    JOIN public.company_reviews r ON r.id = m.review_id WHERE m.id = _message_id;
  IF _company IS NULL THEN RETURN false; END IF;
  SELECT organization_id INTO _org FROM public.profiles WHERE user_id = _company;
  IF NOT ((_org IS NULL AND auth.uid() = _company) OR (_org IS NOT NULL AND public.is_org_admin(auth.uid(), _org))) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  DELETE FROM public.company_review_messages WHERE id = _message_id;
  RETURN FOUND;
END $function$;