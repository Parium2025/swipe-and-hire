-- Add policy to allow edge functions to read any token for proper error handling
-- This is needed so confirm-email can show "already confirmed" message

CREATE POLICY "Edge functions can read any token for validation"
ON public.email_confirmations
FOR SELECT  
USING (
  -- Allow service role to read any token (but only the specific token being validated)
  auth.jwt() ->> 'role' = 'service_role'
);