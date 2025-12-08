-- Fix 1: Restrict organizations SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view organizations" ON public.organizations;

CREATE POLICY "Authenticated users can view organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Make profiles more restrictive - employers can only be viewed by authenticated users
DROP POLICY IF EXISTS "Users can view own profile and employer profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view employer basic info"
ON public.profiles
FOR SELECT
TO authenticated
USING (role = 'employer'::user_role);

-- Fix 3: Restrict profile_view_permissions INSERT to service role or legitimate cases
DROP POLICY IF EXISTS "System can insert permissions" ON public.profile_view_permissions;

-- Create a function to check if user has applied to employer's job
CREATE OR REPLACE FUNCTION public.has_applied_to_employer(p_applicant_id uuid, p_employer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = p_applicant_id
    AND jp.employer_id = p_employer_id
  )
$$;

-- Allow profile view permissions only when there's a valid job application relationship
CREATE POLICY "Permissions created via job application"
ON public.profile_view_permissions
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow if the viewer is an employer who received an application from the profile owner
  has_applied_to_employer(profile_id, viewer_id)
);