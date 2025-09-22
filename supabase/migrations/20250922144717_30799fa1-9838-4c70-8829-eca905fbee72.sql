-- Remove overly permissive RLS policies that allow users to view sensitive authentication tokens
DROP POLICY IF EXISTS "Users can view only their own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users secure own confirmations" ON public.email_confirmations;

-- Keep only secure policies for service operations and super admin access
-- Service role policies remain for edge functions to work properly
-- Super admin policy remains for administrative purposes only

-- Add a new secure function that only returns confirmation status (not tokens)
CREATE OR REPLACE FUNCTION public.get_user_confirmation_status()
RETURNS TABLE(has_pending boolean, is_expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(
      SELECT 1 FROM email_confirmations 
      WHERE user_id = auth.uid() 
        AND confirmed_at IS NULL 
        AND expires_at > now()
    ) as has_pending,
    EXISTS(
      SELECT 1 FROM email_confirmations 
      WHERE user_id = auth.uid() 
        AND confirmed_at IS NULL 
        AND expires_at < now()
    ) as is_expired;
END;
$$;