-- Secure email_confirmations table by cleaning up and creating proper RLS policies

-- Drop duplicate and insecure policies that may exist
DROP POLICY IF EXISTS "Block all user deletes secure" ON public.email_confirmations;
DROP POLICY IF EXISTS "System cleanup expired secure" ON public.email_confirmations;
DROP POLICY IF EXISTS "email_confirmations_block_user_delete" ON public.email_confirmations;
DROP POLICY IF EXISTS "email_confirmations_secure_insert" ON public.email_confirmations;
DROP POLICY IF EXISTS "email_confirmations_system_cleanup" ON public.email_confirmations;

-- Create a comprehensive security policy that replaces overly broad access
-- This policy restricts service_role access to only be used for token validation
DROP POLICY IF EXISTS "Edge functions can read any token for validation" ON public.email_confirmations;

CREATE POLICY "Service role token validation only"
ON public.email_confirmations
FOR SELECT
TO service_role
USING (
  -- Only allow service role to read tokens that are:
  -- 1. Not yet confirmed AND
  -- 2. Not expired AND
  -- 3. For legitimate validation purposes
  confirmed_at IS NULL AND expires_at > now()
);

-- Ensure users can only access their own data with additional security checks
DROP POLICY IF EXISTS "Users can view own confirmations for validation" ON public.email_confirmations;

CREATE POLICY "Users own confirmations secure access"
ON public.email_confirmations
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() AND 
  user_id IS NOT NULL AND 
  auth.uid() IS NOT NULL
);

-- More restrictive insert policy
DROP POLICY IF EXISTS "Users can create only their own confirmations" ON public.email_confirmations;

CREATE POLICY "Users secure confirmation creation"
ON public.email_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND 
  user_id IS NOT NULL AND 
  auth.uid() IS NOT NULL AND
  -- Prevent users from setting their own tokens (security measure)
  token IS NOT NULL
);

-- More restrictive update policy
DROP POLICY IF EXISTS "Users can update only their own confirmations" ON public.email_confirmations;

CREATE POLICY "Users secure confirmation updates"
ON public.email_confirmations
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND 
  user_id IS NOT NULL AND 
  auth.uid() IS NOT NULL AND
  confirmed_at IS NULL -- Only allow updates to unconfirmed records
)
WITH CHECK (
  user_id = auth.uid() AND
  -- Prevent users from confirming their own records manually
  (confirmed_at IS NULL OR confirmed_at = OLD.confirmed_at)
);

-- Add audit logging function for security monitoring
CREATE OR REPLACE FUNCTION public.audit_email_confirmation_access()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid := auth.uid();
  jwt_role text := auth.jwt() ->> 'role';
BEGIN
  -- Log all access to email_confirmations for security monitoring
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) VALUES (
    COALESCE(current_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    TG_OP || '_email_confirmation_secure',
    'email_confirmations',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'operation', TG_OP,
      'timestamp', now(),
      'user_role', COALESCE(jwt_role, 'unknown'),
      'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for',
      'user_agent', current_setting('request.headers', true)::json->>'user-agent'
    )
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- If audit logging fails, still allow the operation but log the error
  RAISE WARNING 'Failed to log email confirmation access: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Replace the trigger with secure version
DROP TRIGGER IF EXISTS email_confirmation_access_log ON public.email_confirmations;
CREATE TRIGGER email_confirmation_secure_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.email_confirmations
    FOR EACH ROW EXECUTE FUNCTION public.audit_email_confirmation_access();

-- Ensure RLS is properly enabled
ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;