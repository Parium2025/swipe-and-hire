CREATE POLICY "Org members can view colleague job postings"
ON public.job_postings
FOR SELECT
TO authenticated
USING (
  same_organization(auth.uid(), employer_id)
);