-- Fix profiles security: Remove overly broad authenticated user access
-- Implement proper role-based access controls

-- Remove the overly permissive policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Keep the policy for users to view their own profiles
-- (This should already exist: "Users can view their own profile")

-- Add policy for employers/recruiters to view job seeker profiles only when there's a legitimate business need
-- This requires checking if they have employer/recruiter role and the profile belongs to a job seeker
CREATE POLICY "Employers can view job seeker profiles" 
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
  )
);

-- Super admins can still view all profiles via existing policy
-- Individual profile owners can still view their own profiles via existing policy