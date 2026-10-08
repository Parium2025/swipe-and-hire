CREATE TABLE public.company_review_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.company_reviews(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_kind text NOT NULL CHECK (author_kind IN ('reviewer','company')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_review_messages_review ON public.company_review_messages(review_id, created_at);

-- author_id hålls dold (anonyma recensenter); läsning bara av publika kolumner.
GRANT SELECT (id, review_id, author_kind, body, created_at) ON public.company_review_messages TO authenticated;
GRANT ALL ON public.company_review_messages TO service_role;
ALTER TABLE public.company_review_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read review threads" ON public.company_review_messages
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.post_company_review_message(_review_id uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _r record; _org uuid; _kind text; _id uuid;
  _trimmed text := nullif(btrim(_body), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _trimmed IS NULL THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF char_length(_trimmed) > 1000 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  SELECT id, company_id, user_id, hidden_author_id, employer_reply INTO _r
    FROM public.company_reviews WHERE id = _review_id;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'review_not_found'; END IF;
  SELECT organization_id INTO _org FROM public.profiles WHERE user_id = _r.company_id;
  IF auth.uid() = _r.user_id OR auth.uid() = _r.hidden_author_id THEN
    _kind := 'reviewer';
    IF _r.employer_reply IS NULL THEN RAISE EXCEPTION 'no_company_reply'; END IF;
  ELSIF (_org IS NULL AND auth.uid() = _r.company_id)
     OR (_org IS NOT NULL AND public.is_org_admin(auth.uid(), _org)) THEN
    _kind := 'company';
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
    VALUES (_review_id, auth.uid(), _kind, _trimmed) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.post_company_review_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_company_review_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_company_review_message(_message_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.company_review_messages WHERE id = _message_id AND author_id = auth.uid();
  RETURN FOUND;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_company_review_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_company_review_message(uuid) TO authenticated;

-- Egna meddelanden: vilka id:n är mina (utan att exponera author_id).
CREATE OR REPLACE FUNCTION public.my_company_review_message_ids(_review_ids uuid[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.company_review_messages
  WHERE review_id = ANY(_review_ids) AND author_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.my_company_review_message_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_company_review_message_ids(uuid[]) TO authenticated;

-- Om bolaget tar bort sitt svar försvinner tråden också.
CREATE OR REPLACE FUNCTION public.clear_review_thread_on_reply_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.employer_reply IS NOT NULL AND NEW.employer_reply IS NULL THEN
    DELETE FROM public.company_review_messages WHERE review_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_clear_review_thread_on_reply_removed AFTER UPDATE OF employer_reply ON public.company_reviews
FOR EACH ROW EXECUTE FUNCTION public.clear_review_thread_on_reply_removed();