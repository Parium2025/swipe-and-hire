-- Fix restrictive RLS policies blocking job edits by making employer/org policies permissive
-- Note: Default policy mode is PERMISSIVE when not specified

-- 1) Drop existing restrictive policies
DROP POLICY IF EXISTS "Company users can manage their organization's job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Employers manage own job postings" ON public.job_postings;

-- 2) Recreate them as PERMISSIVE (default) so either condition allows access
CREATE POLICY "Company users can manage their organization's job postings"
ON public.job_postings
FOR ALL
USING (
  organization_id = public.get_user_organization(auth.uid())
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['company_admin','recruiter','employer'])
)
WITH CHECK (
  organization_id = public.get_user_organization(auth.uid())
);

CREATE POLICY "Employers manage own job postings"
ON public.job_postings
FOR ALL
USING (
  employer_id = auth.uid()
)
WITH CHECK (
  employer_id = auth.uid()
);
