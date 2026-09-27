-- Arbetsgivare kan svara på omdömen om sitt företag
ALTER TABLE public.company_reviews
  ADD COLUMN employer_reply text,
  ADD COLUMN employer_reply_at timestamptz,
  ADD COLUMN employer_reply_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Publik vyn ska visa svaret för alla (nya kolumner sist, annars ogiltig vyändring)
CREATE OR REPLACE VIEW public.company_reviews_public AS
SELECT id,
    company_id,
    rating,
    comment,
    is_anonymous,
    created_at,
    updated_at,
    public_author_id AS user_id,
    employer_reply,
    employer_reply_at
   FROM company_reviews;

-- Säker funktion: bara företagets ägare eller kollegor i samma organisation får svara
CREATE OR REPLACE FUNCTION public.reply_to_company_review(_review_id uuid, _reply text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _caller_org uuid;
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

  SELECT organization_id INTO _caller_org FROM public.profiles WHERE user_id = auth.uid();
  SELECT organization_id INTO _company_org FROM public.profiles WHERE user_id = _company_id;

  IF auth.uid() <> _company_id
     AND (_caller_org IS NULL OR _company_org IS NULL OR _caller_org <> _company_org) THEN
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
$$;

GRANT EXECUTE ON FUNCTION public.reply_to_company_review(uuid, text) TO authenticated;