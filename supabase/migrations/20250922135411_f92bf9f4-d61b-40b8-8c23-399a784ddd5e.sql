-- Remove the overly permissive service role policy that allows reading any token
DROP POLICY "Service role can validate tokens" ON public.email_confirmations;

-- Add enhanced security audit logging for all access to sensitive email confirmation data
CREATE OR REPLACE FUNCTION public.log_email_confirmation_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all access to email confirmations table for security monitoring
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    TG_OP || '_email_confirmation_secure',
    'email_confirmations',
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'timestamp', now(),
      'user_role', COALESCE(auth.jwt() ->> 'role', 'anonymous'),
      'target_user_id', CASE 
        WHEN TG_OP = 'DELETE' THEN OLD.user_id
        ELSE NEW.user_id
      END,
      'security_event', 'email_confirmation_access'
    )
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the main operation if audit logging fails
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;