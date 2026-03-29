CREATE OR REPLACE FUNCTION public.count_distinct_candidates(p_job_ids uuid[])
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT applicant_id)::int
  FROM public.job_applications
  WHERE job_id = ANY(p_job_ids);
$$;