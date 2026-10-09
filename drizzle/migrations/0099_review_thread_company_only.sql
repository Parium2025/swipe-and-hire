-- Tråden under bolagets svar är enbart företagets: recensenten kan inte
-- skriva fler inlägg, och befintliga inlägg från recensenter tas bort.
DELETE FROM public.company_review_messages WHERE author_kind = 'reviewer';

CREATE OR REPLACE FUNCTION public.post_company_review_message(_review_id uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _r record; _org uuid; _id uuid;
  _trimmed text := nullif(btrim(_body), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _trimmed IS NULL THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF char_length(_trimmed) > 1000 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  SELECT id, company_id, user_id, employer_reply INTO _r
    FROM public.company_reviews WHERE id = _review_id;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'review_not_found'; END IF;
  SELECT organization_id INTO _org FROM public.profiles WHERE user_id = _r.company_id;
  IF (_org IS NULL AND auth.uid() = _r.company_id)
     OR (_org IS NOT NULL AND public.is_org_admin(auth.uid(), _org)) THEN
    IF _r.employer_reply IS NULL THEN RAISE EXCEPTION 'no_company_reply'; END IF;
  ELSE
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF (SELECT count(*) FROM public.company_review_messages WHERE review_id = _review_id) >= 100 THEN
    RAISE EXCEPTION 'thread_full';
  END IF;
  IF (SELECT count(*) FROM public.company_review_messages
      WHERE author_id = auth.uid() AND created_at > now() - interval '1 minute') >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  INSERT INTO public.company_review_messages(review_id, author_id, author_kind, body)
    VALUES (_review_id, auth.uid(), 'company', _trimmed) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.post_company_review_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_company_review_message(uuid, text) TO authenticated;