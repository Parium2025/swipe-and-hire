CREATE OR REPLACE FUNCTION public.count_my_candidates_per_list()
RETURNS TABLE (list_id uuid, candidate_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT mc.list_id, count(DISTINCT mc.applicant_id) AS candidate_count
  FROM public.my_candidates mc
  WHERE mc.recruiter_id = auth.uid()
    AND mc.list_id IS NOT NULL
  GROUP BY mc.list_id
$$;

GRANT EXECUTE ON FUNCTION public.count_my_candidates_per_list() TO authenticated;