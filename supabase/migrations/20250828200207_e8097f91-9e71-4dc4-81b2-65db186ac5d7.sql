-- Create more granular RLS policies for profiles table to limit employer access
-- Drop the existing overly permissive employer policy  
DROP POLICY IF EXISTS "Employers can view job seeker profiles with explicit permission" ON public.profiles;

-- Create a new restricted policy that limits what employers can see
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

-- Add audit logging table for sensitive operations  
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

-- Create function for secure token generation
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
  
  -- Log token creation for audit purposes
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name
  ) VALUES (
    auth.uid(),
    'secure_token_created',
    'email_confirmations'
  );
  
  RETURN new_token;
END;
$$;

-- Update email_confirmations RLS to be more restrictive
-- Drop existing policies and create more secure ones
DROP POLICY IF EXISTS "Super admins can manage all confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can view their own email confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can update their own email confirmations" ON public.email_confirmations;

-- Create new restrictive policies
CREATE POLICY "Users can view their own confirmations only" ON public.email_confirmations
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own confirmations only" ON public.email_confirmations  
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert confirmations" ON public.email_confirmations
FOR INSERT
WITH CHECK (true); -- This allows the system to create confirmations

-- Add function to validate file uploads securely
CREATE OR REPLACE FUNCTION public.validate_file_upload(
  file_name text,
  file_size bigint,
  content_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the file upload attempt
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name
  ) VALUES (
    auth.uid(),
    'file_upload_attempt',
    'storage'
  );
  
  -- Validate file size (max 10MB)
  IF file_size > 10485760 THEN
    RETURN false;
  END IF;
  
  -- Validate content type (only images and videos)
  IF content_type NOT LIKE 'image/%' AND content_type NOT LIKE 'video/%' THEN
    RETURN false;
  END IF;
  
  -- Additional security checks can be added here
  
  RETURN true;
END;
$$;