DROP POLICY IF EXISTS "Users can create applications" ON public.job_applications;

CREATE POLICY "Users can create applications"
ON public.job_applications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = applicant_id
  AND EXISTS (
    SELECT 1 FROM public.job_postings jp
    WHERE jp.id = job_applications.job_id
      AND jp.deleted_at IS NULL
  )
);