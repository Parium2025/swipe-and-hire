CREATE OR REPLACE FUNCTION public.get_company_review_stats(p_company_id uuid)
RETURNS TABLE(total_count bigint, avg_rating numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint, avg(rating)::numeric
  FROM public.company_reviews
  WHERE company_id = p_company_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_review_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_review_stats(uuid) TO anon;