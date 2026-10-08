CREATE OR REPLACE FUNCTION public.my_company_review_ids(_review_ids uuid[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.company_reviews
  WHERE id = ANY(_review_ids) AND (user_id = auth.uid() OR hidden_author_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.my_company_review_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_company_review_ids(uuid[]) TO authenticated;