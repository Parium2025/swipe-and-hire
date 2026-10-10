CREATE OR REPLACE FUNCTION public.post_company_review_message(_review_id uuid, _body text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _r record; _org uuid; _id uuid; _kind text;
  _trimmed text := nullif(btrim(_body), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _trimmed IS NULL THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF char_length(_trimmed) > 1000 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  SELECT id, company_id, user_id, employer_reply INTO _r FROM public.company_reviews WHERE id = _review_id FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'review_not_found'; END IF;
  SELECT organization_id INTO _org FROM public.profiles WHERE user_id = _r.company_id;
  IF (_org IS NULL AND auth.uid() = _r.company_id) OR (_org IS NOT NULL AND public.is_org_admin(auth.uid(), _org)) THEN
    _kind := 'company';
  ELSIF auth.uid() = _r.user_id THEN
    _kind := 'reviewer';
  ELSE
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _r.employer_reply IS NULL THEN RAISE EXCEPTION 'no_company_reply'; END IF;
  IF (SELECT count(*) FROM public.company_review_messages WHERE review_id = _review_id) >= 100 THEN RAISE EXCEPTION 'thread_full'; END IF;
  IF (SELECT count(*) FROM public.company_review_messages WHERE author_id = auth.uid() AND created_at > now() - interval '1 minute') >= 5 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO public.company_review_messages(review_id, author_id, author_kind, body)
    VALUES (_review_id, auth.uid(), _kind, _trimmed) RETURNING id INTO _id;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.edit_company_review_message(_message_id uuid, _body text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _m record; _org uuid; _b text := btrim(coalesce(_body, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _b = '' THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF char_length(_b) > 1000 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  SELECT m.author_kind, m.author_id, r.company_id, r.user_id AS reviewer INTO _m
    FROM public.company_review_messages m JOIN public.company_reviews r ON r.id = m.review_id WHERE m.id = _message_id;
  IF _m.company_id IS NULL THEN RETURN false; END IF;
  IF _m.author_kind = 'reviewer' THEN
    IF auth.uid() IS DISTINCT FROM _m.reviewer OR auth.uid() IS DISTINCT FROM _m.author_id THEN RAISE EXCEPTION 'not_authorized'; END IF;
  ELSE
    SELECT organization_id INTO _org FROM public.profiles WHERE user_id = _m.company_id;
    IF NOT ((_org IS NULL AND auth.uid() = _m.company_id) OR (_org IS NOT NULL AND public.is_org_admin(auth.uid(), _org))) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  END IF;
  UPDATE public.company_review_messages SET body = _b WHERE id = _message_id;
  RETURN FOUND;
END $function$;

CREATE OR REPLACE FUNCTION public.delete_company_review_message(_message_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _m record; _org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT m.author_kind, m.author_id, r.company_id, r.user_id AS reviewer INTO _m
    FROM public.company_review_messages m JOIN public.company_reviews r ON r.id = m.review_id WHERE m.id = _message_id;
  IF _m.company_id IS NULL THEN RETURN false; END IF;
  IF _m.author_kind = 'reviewer' AND auth.uid() = _m.reviewer AND auth.uid() = _m.author_id THEN
    NULL;
  ELSE
    SELECT organization_id INTO _org FROM public.profiles WHERE user_id = _m.company_id;
    IF NOT ((_org IS NULL AND auth.uid() = _m.company_id) OR (_org IS NOT NULL AND public.is_org_admin(auth.uid(), _org))) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  END IF;
  DELETE FROM public.company_review_messages WHERE id = _message_id;
  RETURN FOUND;
END $function$;

DELETE FROM public.notifications WHERE id = 'f8ee6c38-3ef7-47c7-a600-a0b274d1a9d3';