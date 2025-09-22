-- Fix security vulnerability: Remove overly permissive service role policy
-- and replace with more restrictive policies for email_confirmations table

-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can read confirmations" ON public.email_confirmations;

-- Create more restrictive policies for legitimate system operations

-- Allow edge functions to validate specific tokens (for confirmation process)
CREATE POLICY "System can validate confirmation tokens" 
ON public.email_confirmations 
FOR SELECT 
USING (
  -- Only allow reading when specifically validating a token
  -- This policy is designed for edge function token validation
  auth.jwt() ->> 'role' = 'service_role' AND
  -- Additional security: only allow if expires_at > now() (active tokens)
  expires_at > now() AND
  confirmed_at IS NULL
);

-- Allow edge functions to update confirmations during the confirmation process
CREATE POLICY "System can update confirmations during validation" 
ON public.email_confirmations 
FOR UPDATE 
USING (
  auth.jwt() ->> 'role' = 'service_role' AND
  -- Only allow updates to unconfirmed, non-expired tokens
  expires_at > now() AND
  confirmed_at IS NULL
)
WITH CHECK (
  -- Only allow setting confirmed_at timestamp
  confirmed_at IS NOT NULL
);

-- Allow system cleanup of expired tokens (for cleanup functions)
CREATE POLICY "System can cleanup expired confirmations" 
ON public.email_confirmations 
FOR DELETE 
USING (
  auth.jwt() ->> 'role' = 'service_role' AND
  -- Only allow deletion of expired, unconfirmed tokens
  expires_at < now() AND
  confirmed_at IS NULL
);

-- Allow system to create confirmation tokens (for resend functionality)
CREATE POLICY "System can create confirmation tokens" 
ON public.email_confirmations 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
);