CREATE OR REPLACE FUNCTION public.has_applied_to_job(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_applications ja
    WHERE ja.job_id = p_job_id
      AND ja.applicant_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_applied_to_job(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Applicants can view applied job postings" ON public.job_postings;

CREATE POLICY "Applicants can view applied job postings"
ON public.job_postings
FOR SELECT
TO authenticated
USING (public.has_applied_to_job(id));