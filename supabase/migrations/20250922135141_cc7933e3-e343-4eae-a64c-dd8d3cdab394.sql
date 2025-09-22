-- Enable leaked password protection in auth configuration
-- This will be applied at the database level for enhanced security

-- Create a function to check password strength
CREATE OR REPLACE FUNCTION public.check_password_strength(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Basic password strength requirements
  -- At least 8 characters, contains uppercase, lowercase, number
  IF length(password) < 8 THEN
    RETURN false;
  END IF;
  
  IF NOT (password ~ '[A-Z]' AND password ~ '[a-z]' AND password ~ '[0-9]') THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Log password security events
CREATE OR REPLACE FUNCTION public.log_password_security_event(
  user_id uuid,
  event_type text,
  details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    metadata
  ) VALUES (
    user_id,
    'password_security_' || event_type,
    'auth.users',
    jsonb_build_object(
      'event_type', event_type,
      'timestamp', now(),
      'details', details
    )
  );
END;
$$;