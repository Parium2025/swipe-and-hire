-- Fix email functionality by adding back necessary policies for edge functions
-- These are more secure than the old blanket service role policy

-- Allow edge functions to read active confirmation tokens (for validation)
CREATE POLICY "Edge functions can read active tokens for validation"
ON public.email_confirmations
FOR SELECT
USING (
  -- Only allow service role to read unconfirmed, non-expired tokens
  auth.jwt() ->> 'role' = 'service_role' AND
  confirmed_at IS NULL AND
  expires_at > now()
);

-- Allow edge functions to mark tokens as confirmed
CREATE POLICY "Edge functions can mark tokens confirmed"  
ON public.email_confirmations
FOR UPDATE
USING (
  -- Only allow service role to update unconfirmed tokens
  auth.jwt() ->> 'role' = 'service_role' AND
  confirmed_at IS NULL
)
WITH CHECK (
  -- Only allow setting confirmed_at timestamp
  confirmed_at IS NOT NULL
);

-- Allow edge functions to create confirmation tokens (for resend)
CREATE POLICY "Edge functions can create tokens"
ON public.email_confirmations
FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
);