-- Fix email_confirmations security by updating existing policies and adding audit logging

-- Replace the overly broad service role policy with a more restrictive one
DROP POLICY IF EXISTS "Edge functions can read any token for validation" ON public.email_confirmations;

CREATE POLICY "Service role validation restricted"
ON public.email_confirmations
FOR SELECT
TO service_role
USING (
  -- Only allow reading active, unconfirmed tokens for validation
  confirmed_at IS NULL AND expires_at > now()
);

-- Enhance user access policy with additional security checks
DROP POLICY IF EXISTS "Users can view own confirmations for validation" ON public.email_confirmations;

CREATE POLICY "Users secure own confirmations"
ON public.email_confirmations
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() AND 
  user_id IS NOT NULL AND 
  auth.uid() IS NOT NULL
);

-- Enhanced insert policy for users
DROP POLICY IF EXISTS "Users can create only their own confirmations" ON public.email_confirmations;

CREATE POLICY "Users create own confirmations secure"
ON public.email_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND 
  user_id IS NOT NULL AND 
  auth.uid() IS NOT NULL
);

-- Enhanced update policy 
DROP POLICY IF EXISTS "Users can update only their own confirmations" ON public.email_confirmations;

CREATE POLICY "Users update own confirmations secure" 
ON public.email_confirmations
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND 
  confirmed_at IS NULL -- Only unconfirmed records
)
WITH CHECK (
  user_id = auth.uid()
);

-- Create secure audit logging function
CREATE OR REPLACE FUNCTION public.log_confirmation_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access for security monitoring
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    TG_OP || '_email_confirmation',
    'email_confirmations',
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'timestamp', now(),
      'user_role', COALESCE(auth.jwt() ->> 'role', 'authenticated')
    )
  );
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS email_confirmation_access_audit ON public.email_confirmations;
CREATE TRIGGER email_confirmation_access_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.email_confirmations
    FOR EACH ROW EXECUTE FUNCTION public.log_confirmation_access();