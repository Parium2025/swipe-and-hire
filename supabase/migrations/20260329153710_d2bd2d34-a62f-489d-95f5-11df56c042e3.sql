CREATE OR REPLACE FUNCTION public.count_distinct_my_candidates(p_recruiter_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT applicant_id)::int
  FROM public.my_candidates
  WHERE recruiter_id = p_recruiter_id;
$$;