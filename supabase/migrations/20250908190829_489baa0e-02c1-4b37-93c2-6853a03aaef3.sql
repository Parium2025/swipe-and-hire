-- Update the security function to remove admin access and add logging
CREATE OR REPLACE FUNCTION public.can_access_confirmation_data(confirmation_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only the user themselves can access their confirmation data
  IF confirmation_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Log any unauthorized access attempts
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    record_id
  ) VALUES (
    auth.uid(),
    'unauthorized_confirmation_access_attempt',
    'email_confirmations',
    confirmation_user_id
  );
  
  RETURN false;
END;
$$;

-- Add unique index for tokens to prevent token reuse
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_confirmations_token 
ON public.email_confirmations(token);

-- Add constraint to prevent multiple active confirmations per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_confirmations_active_user 
ON public.email_confirmations(user_id) 
WHERE confirmed_at IS NULL;