-- Create a security definer function to verify employer owns a job
CREATE OR REPLACE FUNCTION public.employer_owns_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM job_postings
    WHERE id = p_job_id
    AND employer_id = auth.uid()
  );
END;
$$;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Employers can view applications to their jobs" ON public.job_applications;
DROP POLICY IF EXISTS "Employers can update applications to their jobs" ON public.job_applications;

-- Create new stricter policies using the security definer function
CREATE POLICY "Employers can view applications to their jobs"
ON public.job_applications
FOR SELECT
USING (public.employer_owns_job(job_id));

CREATE POLICY "Employers can update applications to their jobs"
ON public.job_applications
FOR UPDATE
USING (public.employer_owns_job(job_id));