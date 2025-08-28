-- Fix job seeker privacy with proper consent-based access
-- First check if table exists and handle conflicts

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can manage their own view permissions" ON public.profile_view_permissions;
DROP POLICY IF EXISTS "Employers can view job seeker profiles with permission" ON public.profiles;

-- Create profile view permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profile_view_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_seeker_id uuid NOT NULL,
  employer_id uuid NOT NULL,
  job_posting_id uuid,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  permission_type text NOT NULL DEFAULT 'application_based',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_permission UNIQUE(job_seeker_id, employer_id, job_posting_id)
);

-- Enable RLS if not already enabled
ALTER TABLE public.profile_view_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for the permissions table
CREATE POLICY "Job seekers can manage permissions granted to them" 
ON public.profile_view_permissions 
FOR ALL 
TO authenticated
USING (job_seeker_id = auth.uid());

CREATE POLICY "Employers can view permissions granted to them" 
ON public.profile_view_permissions 
FOR SELECT 
TO authenticated
USING (employer_id = auth.uid());

-- Super admins can manage all permissions
CREATE POLICY "Super admins can manage all permissions" 
ON public.profile_view_permissions 
FOR ALL 
TO authenticated
USING (is_super_admin(auth.uid()));

-- Now create the restrictive profile access policy
-- Employers can only see job seeker profiles when explicitly granted permission
CREATE POLICY "Employers can view job seeker profiles with explicit permission" 
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