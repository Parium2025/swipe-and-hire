-- Fix security issue with email_confirmations table access

-- First, drop the existing overly permissive policy
DROP POLICY IF EXISTS "Controlled admin access to confirmations" ON public.email_confirmations;

-- Create more restrictive policies for different operations

-- Users can only view their own confirmations
-- No admin access for viewing - users should only see their own data
CREATE POLICY "Users can view own email confirmations" 
ON public.email_confirmations 
FOR SELECT 
USING (user_id = auth.uid());

-- Users can only insert their own confirmations
CREATE POLICY "Users can create own email confirmations" 
ON public.email_confirmations 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Users can only update their own confirmations
-- Keep existing policy but make it more explicit
DROP POLICY IF EXISTS "Users can update their own email confirmations" ON public.email_confirmations;
CREATE POLICY "Users can update own email confirmations" 
ON public.email_confirmations 
FOR UPDATE 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- Only allow system/service role to delete confirmations (for cleanup)
-- Regular users and admins cannot delete confirmation records
CREATE POLICY "System can delete expired confirmations" 
ON public.email_confirmations 
FOR DELETE 
USING (false); -- This effectively blocks all deletes through RLS, only service role can delete

-- Update the can_access_confirmation_data function to be more restrictive
-- Remove admin access entirely for this sensitive data
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
$function$

-- Add additional security: ensure tokens are unique and properly indexed
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_confirmations_token ON public.email_confirmations(token);

-- Add constraint to prevent duplicate active confirmations per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_confirmations_active_user 
ON public.email_confirmations(user_id) 
WHERE confirmed_at IS NULL;