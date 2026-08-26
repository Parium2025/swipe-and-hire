
DROP POLICY IF EXISTS "Employers can create notes" ON public.candidate_notes;
CREATE POLICY "Employers can create notes"
ON public.candidate_notes
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = employer_id
  AND (
    (job_id IS NOT NULL AND public.can_view_job_application(job_id))
    OR (job_id IS NULL AND EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.applicant_id = candidate_notes.applicant_id
        AND public.can_view_job_application(ja.job_id)
    ))
  )
);

DROP POLICY IF EXISTS "Employers can update their own notes" ON public.candidate_notes;
CREATE POLICY "Employers can update their own notes"
ON public.candidate_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = employer_id)
WITH CHECK (
  auth.uid() = employer_id
  AND (
    (job_id IS NOT NULL AND public.can_view_job_application(job_id))
    OR (job_id IS NULL AND EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.applicant_id = candidate_notes.applicant_id
        AND public.can_view_job_application(ja.job_id)
    ))
  )
);

DROP POLICY IF EXISTS "Recruiters can create ratings" ON public.candidate_ratings;
CREATE POLICY "Recruiters can create ratings"
ON public.candidate_ratings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = recruiter_id
  AND (
    (job_id IS NOT NULL AND public.can_view_job_application(job_id))
    OR (job_id IS NULL AND EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.applicant_id = candidate_ratings.applicant_id
        AND public.can_view_job_application(ja.job_id)
    ))
  )
);

DROP POLICY IF EXISTS "Recruiters can update their own ratings" ON public.candidate_ratings;
CREATE POLICY "Recruiters can update their own ratings"
ON public.candidate_ratings
FOR UPDATE
TO authenticated
USING (auth.uid() = recruiter_id)
WITH CHECK (
  auth.uid() = recruiter_id
  AND (
    (job_id IS NOT NULL AND public.can_view_job_application(job_id))
    OR (job_id IS NULL AND EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.applicant_id = candidate_ratings.applicant_id
        AND public.can_view_job_application(ja.job_id)
    ))
  )
);
