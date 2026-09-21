-- Skalning: systempanelen hämtade views_count för ALLA annonser till klienten
-- för att summera dem. Summeringen görs nu i databasen och returnerar ett tal.
CREATE OR REPLACE FUNCTION public.get_total_job_views()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(views_count), 0)::bigint FROM public.job_postings;
$$;

REVOKE ALL ON FUNCTION public.get_total_job_views() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_total_job_views() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_job_views() TO service_role;