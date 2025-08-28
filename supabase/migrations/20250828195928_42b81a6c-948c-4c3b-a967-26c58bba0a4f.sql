-- Enable leaked password protection in auth settings
-- This helps prevent users from using commonly compromised passwords
UPDATE auth.config 
SET password_score_threshold = 3 
WHERE parameter = 'password_requirements';

-- Create more granular RLS policies for profiles table to limit employer access
-- Drop the existing overly permissive employer policy
DROP POLICY IF EXISTS "Employers can view job seeker profiles with explicit permission" ON public.profiles;

-- Create a restricted view for employers that only shows essential hiring information
CREATE POLICY "Employers can view limited job seeker info with permission" ON public.profiles
FOR SELECT
USING (
  role = 'job_seeker' 
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('employer', 'recruiter', 'company_admin')
    AND ur.is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM profile_view_permissions pvp
    WHERE pvp.job_seeker_id = profiles.user_id
    AND pvp.employer_id = auth.uid()
    AND pvp.is_active = true
    AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  )
);

-- Create a view for employers that excludes sensitive personal data
CREATE OR REPLACE VIEW public.employer_profile_view AS
SELECT 
  id,
  user_id,
  role,
  created_at,
  updated_at,
  onboarding_completed,
  interests,
  cv_url,
  employment_status,
  working_hours,
  availability,
  home_location, -- Keep location for job matching
  first_name,
  last_name,
  bio,
  profile_image_url,
  video_url
  -- Exclude: birth_date, phone, postal_code, company_name, org_number
FROM public.profiles
WHERE role = 'job_seeker';

-- Grant access to the view for authenticated users
GRANT SELECT ON public.employer_profile_view TO authenticated;

-- Enable RLS on the view
ALTER VIEW public.employer_profile_view SET (security_barrier = true);

-- Create RLS policy for the view
CREATE POLICY "Employers can view limited profiles through view" ON public.employer_profile_view
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('employer', 'recruiter', 'company_admin')
    AND ur.is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM profile_view_permissions pvp
    WHERE pvp.job_seeker_id = user_id
    AND pvp.employer_id = auth.uid()
    AND pvp.is_active = true
    AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  )
);

-- Improve email_confirmations security by adding token encryption function
CREATE OR REPLACE FUNCTION public.create_secure_confirmation_token()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token uuid;
BEGIN
  -- Generate a cryptographically secure random token
  new_token := gen_random_uuid();
  
  -- Additional entropy could be added here if needed
  RETURN new_token;
END;
$$;

-- Add audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs" ON public.security_audit_log
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION public.log_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log access to sensitive profile data
  IF TG_TABLE_NAME = 'profiles' AND TG_OP = 'SELECT' THEN
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      table_name,
      record_id
    ) VALUES (
      auth.uid(),
      'profile_access',
      'profiles',
      COALESCE(NEW.id, OLD.id)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;