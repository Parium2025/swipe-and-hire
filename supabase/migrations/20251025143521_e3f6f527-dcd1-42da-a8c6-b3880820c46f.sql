-- Fix RLS policy for organization-based application access
DROP POLICY IF EXISTS "Employers can view applications for their jobs" ON job_applications;

CREATE POLICY "Organization members can view applications for their jobs"
ON job_applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_postings jp
    WHERE jp.id = job_applications.job_id
    AND jp.organization_id = get_user_organization(auth.uid())
  )
);

-- Also update the UPDATE policy to use organization
DROP POLICY IF EXISTS "Employers can update applications for their jobs" ON job_applications;

CREATE POLICY "Organization members can update applications for their jobs"
ON job_applications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM job_postings jp
    WHERE jp.id = job_applications.job_id
    AND jp.organization_id = get_user_organization(auth.uid())
  )
);