-- 1. Add RLS policy for employers to view applications to their job postings
CREATE POLICY "Employers can view applications to their jobs"
ON public.job_applications
FOR SELECT
USING (
  job_id IN (
    SELECT id FROM public.job_postings WHERE employer_id = auth.uid()
  )
);

-- 2. Add RLS policy for employers to update applications to their jobs (for status changes)
CREATE POLICY "Employers can update applications to their jobs"
ON public.job_applications
FOR UPDATE
USING (
  job_id IN (
    SELECT id FROM public.job_postings WHERE employer_id = auth.uid()
  )
);

-- 3. Create security definer function to get applicant profile image
-- This allows employers to view profile images of applicants who applied to their jobs
CREATE OR REPLACE FUNCTION public.get_applicant_profile_image(p_applicant_id uuid, p_employer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile_image_url text;
BEGIN
  -- Check if employer has an application from this applicant
  IF EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = p_applicant_id
    AND jp.employer_id = p_employer_id
  ) THEN
    SELECT profile_image_url INTO v_profile_image_url
    FROM profiles
    WHERE user_id = p_applicant_id;
    
    RETURN v_profile_image_url;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;