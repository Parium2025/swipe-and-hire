-- Fix email_confirmations security vulnerabilities with focused approach

-- First, remove the overly permissive service role policy
DROP POLICY IF EXISTS "Edge functions can read any token for validation" ON public.email_confirmations;

-- Create a more restrictive service role policy for token validation
CREATE POLICY "Service role limited token access"
ON public.email_confirmations
FOR SELECT
TO service_role
USING (
  -- Only allow access to active, unconfirmed tokens for validation
  confirmed_at IS NULL AND 
  expires_at > now()
);

-- Remove any duplicate or conflicting policies
DROP POLICY IF EXISTS "email_confirmations_block_user_delete" ON public.email_confirmations;
DROP POLICY IF EXISTS "email_confirmations_secure_insert" ON public.email_confirmations;
DROP POLICY IF EXISTS "email_confirmations_system_cleanup" ON public.email_confirmations;
DROP POLICY IF EXISTS "Block all user deletes secure" ON public.email_confirmations;
DROP POLICY IF EXISTS "System cleanup expired secure" ON public.email_confirmations;

-- Add comprehensive audit logging for security monitoring
CREATE OR REPLACE FUNCTION public.secure_email_confirmation_audit()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all operations on email_confirmations for security monitoring
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    TG_OP || '_email_confirmation_audit',
    'email_confirmations',
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'timestamp', now(),
      'user_role', COALESCE(auth.jwt() ->> 'role', 'unknown'),
      'affected_user', CASE 
        WHEN TG_OP = 'DELETE' THEN OLD.user_id
        ELSE NEW.user_id
      END
    )
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN OTHERS THEN
  -- If audit logging fails, allow the operation but log a warning
  RAISE WARNING 'Email confirmation audit failed: %', SQLERRM;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the audit trigger
DROP TRIGGER IF EXISTS email_confirmation_access_log ON public.email_confirmations;
DROP TRIGGER IF EXISTS email_confirmation_secure_audit ON public.email_confirmations;

CREATE TRIGGER email_confirmation_security_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.email_confirmations
    FOR EACH ROW EXECUTE FUNCTION public.secure_email_confirmation_audit();

-- Verify RLS is enabled
ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;