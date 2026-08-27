DROP POLICY IF EXISTS "Users can create applications" ON public.job_applications;

CREATE POLICY "Users can create applications"
ON public.job_applications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = applicant_id
  AND EXISTS (
    SELECT 1
    FROM public.job_postings jp
    WHERE jp.id = job_applications.job_id
      AND jp.deleted_at IS NULL
      AND jp.is_active = true
      -- 24h respit så offline-köade ansökningar inte tappas om annonsen
      -- hinner gå ut medan användaren var utan nät.
      AND (jp.expires_at IS NULL OR jp.expires_at > now() - interval '24 hours')
  )
);