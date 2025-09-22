-- Clean up and secure email_confirmations RLS policies

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "Block all user deletes on confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Block all user deletes secure" ON public.email_confirmations;
DROP POLICY IF EXISTS "Edge functions can confirm tokens" ON public.email_confirmations;
DROP POLICY IF EXISTS "Edge functions can create tokens" ON public.email_confirmations;
DROP POLICY IF EXISTS "Edge functions can read any token for validation" ON public.email_confirmations;
DROP POLICY IF EXISTS "Edge functions can validate active tokens" ON public.email_confirmations;
DROP POLICY IF EXISTS "Super admins can view confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "System can cleanup expired confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "System cleanup expired secure" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can create only their own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can update only their own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can view own confirmations for validation" ON public.email_confirmations;
DROP POLICY IF EXISTS "email_confirmations_block_user_delete" ON public.email_confirmations;
DROP POLICY IF EXISTS "email_confirmations_secure_insert" ON public.email_confirmations;
DROP POLICY IF EXISTS "email_confirmations_system_cleanup" ON public.email_confirmations;

-- Create secure, non-overlapping policies

-- SELECT policies: Most restrictive access
CREATE POLICY "Users can view only their own confirmations"
ON public.email_confirmations
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role can validate tokens"
ON public.email_confirmations
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Super admins can view all confirmations"
ON public.email_confirmations
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- INSERT policies: Only service role and users for their own records
CREATE POLICY "Service role can create confirmations"
ON public.email_confirmations
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users can create only their own confirmations"
ON public.email_confirmations
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND user_id IS NOT NULL);

-- UPDATE policies: Very restrictive
CREATE POLICY "Service role can update confirmations"
ON public.email_confirmations
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can update only their own unconfirmed tokens"
ON public.email_confirmations
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND confirmed_at IS NULL)
WITH CHECK (user_id = auth.uid());

-- DELETE policies: Block all user deletes, allow system cleanup
CREATE POLICY "Block all user deletes"
ON public.email_confirmations
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "Service role can cleanup expired confirmations"
ON public.email_confirmations
FOR DELETE
TO service_role
USING (confirmed_at IS NULL AND expires_at < now());

-- Ensure RLS is enabled
ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;

-- Add additional security audit logging
CREATE OR REPLACE FUNCTION public.log_email_confirmation_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access attempts to sensitive email confirmation data
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
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'operation', TG_OP,
      'timestamp', now(),
      'user_role', COALESCE(auth.jwt() ->> 'role', 'unknown')
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to log access
DROP TRIGGER IF EXISTS email_confirmation_access_log ON public.email_confirmations;
CREATE TRIGGER email_confirmation_access_log
    AFTER INSERT OR UPDATE OR DELETE ON public.email_confirmations
    FOR EACH ROW EXECUTE FUNCTION public.log_email_confirmation_access();