-- Fix job seeker privacy: Implement consent-based access to personal information
-- Remove overly broad employer access and implement application-based access

-- Remove the overly broad employer access policy
DROP POLICY IF EXISTS "Employers can view job seeker profiles" ON public.profiles;

-- Create a table to track profile view permissions/consents
CREATE TABLE IF NOT EXISTS public.profile_view_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_seeker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE CASCADE,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  permission_type text NOT NULL DEFAULT 'application_based', -- 'application_based', 'explicit_consent'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(job_seeker_id, employer_id, job_posting_id)
);

-- Enable RLS on the new table
ALTER TABLE public.profile_view_permissions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own permissions
CREATE POLICY "Users can manage their own view permissions" 
ON public.profile_view_permissions 
FOR ALL 
TO authenticated
USING (job_seeker_id = auth.uid() OR employer_id = auth.uid())
WITH CHECK (job_seeker_id = auth.uid() OR employer_id = auth.uid());

-- Create a more restrictive policy for employer access to job seeker profiles
-- Only allow access when there's explicit permission granted
CREATE POLICY "Employers can view job seeker profiles with permission" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  role = 'job_seeker' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('employer', 'recruiter', 'company_admin')
    AND ur.is_active = true
  ) AND
  EXISTS (
    SELECT 1 FROM public.profile_view_permissions pvp
    WHERE pvp.job_seeker_id = profiles.user_id
    AND pvp.employer_id = auth.uid()
    AND pvp.is_active = true
    AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  )
);

-- Create function to grant permission when someone applies to a job
CREATE OR REPLACE FUNCTION public.grant_profile_access_on_application()
RETURNS TRIGGER AS $$
BEGIN
  -- Grant profile access to the employer when someone applies to their job
  INSERT INTO public.profile_view_permissions (
    job_seeker_id, 
    employer_id, 
    job_posting_id,
    permission_type,
    expires_at
  )
  SELECT 
    NEW.applicant_id,
    jp.employer_id,
    NEW.job_id,
    'application_based',
    now() + interval '90 days' -- Access expires after 90 days
  FROM public.job_postings jp
  WHERE jp.id = NEW.job_id
  ON CONFLICT (job_seeker_id, employer_id, job_posting_id) 
  DO UPDATE SET 
    is_active = true,
    expires_at = now() + interval '90 days';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;