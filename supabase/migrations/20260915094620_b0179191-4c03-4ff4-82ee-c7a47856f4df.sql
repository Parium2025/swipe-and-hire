CREATE OR REPLACE FUNCTION public.get_company_review_stats_batch(p_company_ids uuid[])
RETURNS TABLE(company_id uuid, total_count bigint, avg_rating numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT r.company_id, count(*)::bigint, avg(r.rating)::numeric
  FROM public.company_reviews r
  WHERE r.company_id = ANY(p_company_ids)
  GROUP BY r.company_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_review_stats_batch(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_review_stats_batch(uuid[]) TO anon;