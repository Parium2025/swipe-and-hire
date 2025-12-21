-- Helper function to check if employer can view application (direct owner OR same org)
CREATE OR REPLACE FUNCTION public.can_view_job_application(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Direct owner
    SELECT 1 FROM job_postings WHERE id = p_job_id AND employer_id = auth.uid()
  ) OR EXISTS (
    -- Same organization
    SELECT 1
    FROM job_postings jp
    JOIN user_roles ur_job ON ur_job.user_id = jp.employer_id AND ur_job.is_active = true
    JOIN user_roles ur_me ON ur_me.user_id = auth.uid() AND ur_me.is_active = true
    WHERE jp.id = p_job_id
      AND ur_job.organization_id = ur_me.organization_id
      AND ur_job.organization_id IS NOT NULL
  )
$$;

-- Update RLS policy for employers viewing applications
DROP POLICY IF EXISTS "Employers can view applications to their jobs" ON public.job_applications;

CREATE POLICY "Employers can view applications to org jobs"
ON public.job_applications
FOR SELECT
USING (can_view_job_application(job_id));

-- Update RLS policy for employers updating applications
DROP POLICY IF EXISTS "Employers can update applications to their jobs" ON public.job_applications;

CREATE POLICY "Employers can update applications to org jobs"
ON public.job_applications
FOR UPDATE
USING (can_view_job_application(job_id));