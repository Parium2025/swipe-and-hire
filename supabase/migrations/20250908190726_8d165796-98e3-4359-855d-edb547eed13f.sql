-- Update the can_access_confirmation_data function to be more restrictive
CREATE OR REPLACE FUNCTION public.can_access_confirmation_data(confirmation_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only the user themselves can access their confirmation data
  -- Remove admin access entirely for this sensitive data
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
$function$;