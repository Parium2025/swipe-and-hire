-- Fix security vulnerability in email_confirmations access control

-- Remove the overly permissive admin access policy
DROP POLICY IF EXISTS "Controlled admin access to confirmations" ON public.email_confirmations;

-- Create a secure policy that blocks delete operations for all users
-- (only service role should be able to delete for cleanup)
CREATE POLICY "Block all user deletes on confirmations" 
ON public.email_confirmations 
FOR DELETE 
USING (false);

-- Update the access control function to remove admin bypass
CREATE OR REPLACE FUNCTION public.can_access_confirmation_data(confirmation_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow access if the user owns the confirmation data
  IF confirmation_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Log unauthorized access attempts for security monitoring
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    record_id
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'unauthorized_confirmation_access_attempt',
    'email_confirmations',
    confirmation_user_id
  );
  
  RETURN false;
END;
$function$;