-- Allow users to view job postings they have saved (even inactive ones)
CREATE POLICY "Users can view their saved job postings"
ON public.job_postings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.saved_jobs sj
    WHERE sj.job_id = job_postings.id
    AND sj.user_id = auth.uid()
  )
);

-- Allow users to view job postings they have applied to (even inactive ones)
CREATE POLICY "Applicants can view applied job postings"
ON public.job_postings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_applications ja
    WHERE ja.job_id = job_postings.id
    AND ja.applicant_id = auth.uid()
  )
);