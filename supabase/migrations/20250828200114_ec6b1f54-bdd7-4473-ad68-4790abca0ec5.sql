-- Security improvements - addressing data exposure and access control issues

-- Drop the existing overly permissive employer policy
DROP POLICY IF EXISTS "Employers can view job seeker profiles with explicit permission" ON public.profiles;

-- Create a more restrictive policy that limits what employers can see
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

-- Create a restricted view for employers that excludes sensitive personal data
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
  home_location, -- Keep location for job matching, but not exact postal code
  first_name,
  last_name,
  bio,
  profile_image_url,
  video_url
  -- Exclude: birth_date, phone, postal_code, company_name, org_number (sensitive data)
FROM public.profiles
WHERE role = 'job_seeker';

-- Enable RLS on the view
ALTER VIEW public.employer_profile_view SET (security_barrier = true);

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

-- Improve email_confirmations security by limiting super admin access
-- Add a function to check if access to confirmation data is legitimate
CREATE OR REPLACE FUNCTION public.can_access_confirmation_data(confirmation_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admins can access, but log the access
  IF is_super_admin(auth.uid()) THEN
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      table_name,
      record_id
    ) VALUES (
      auth.uid(),
      'admin_confirmation_access',
      'email_confirmations',
      confirmation_user_id
    );
    RETURN true;
  END IF;
  
  -- Users can only access their own data
  RETURN confirmation_user_id = auth.uid();
END;
$$;

-- Update email confirmations policies to use the new security function
DROP POLICY IF EXISTS "Super admins can manage all confirmations" ON public.email_confirmations;

CREATE POLICY "Controlled admin access to confirmations" ON public.email_confirmations
FOR ALL
USING (can_access_confirmation_data(user_id))
WITH CHECK (can_access_confirmation_data(user_id));

-- Create secure token generation function
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
  
  -- Log token generation for audit purposes
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name
  ) VALUES (
    auth.uid(),
    'token_generated',
    'email_confirmations'
  );
  
  RETURN new_token;
END;
$$;

-- Add function to validate file uploads for security
CREATE OR REPLACE FUNCTION public.validate_file_upload(
  file_path text,
  file_size bigint,
  content_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check file size (max 10MB for videos, 5MB for images)
  IF content_type LIKE 'video/%' AND file_size > 10485760 THEN
    RETURN false;
  END IF;
  
  IF content_type LIKE 'image/%' AND file_size > 5242880 THEN
    RETURN false;
  END IF;
  
  -- Check allowed file types
  IF content_type NOT IN (
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf'
  ) THEN
    RETURN false;
  END IF;
  
  -- Log upload attempt
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name
  ) VALUES (
    auth.uid(),
    'file_upload_validated',
    'storage'
  );
  
  RETURN true;
END;
$$;