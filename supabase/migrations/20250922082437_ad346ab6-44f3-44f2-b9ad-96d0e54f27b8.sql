-- Fix security vulnerability: Remove overly permissive service role policy
-- and replace with more restrictive policies for email_confirmations table

-- Drop the overly permissive service role policy that allows unrestricted read access
DROP POLICY IF EXISTS "Service role can read confirmations" ON public.email_confirmations;

-- Create more restrictive policies for legitimate system operations with unique names

-- Allow edge functions to validate specific tokens during confirmation process only
CREATE POLICY "Edge functions can validate active tokens" 
ON public.email_confirmations 
FOR SELECT 
USING (
  -- Only allow reading by service role for active, unconfirmed tokens
  auth.jwt() ->> 'role' = 'service_role' AND
  expires_at > now() AND
  confirmed_at IS NULL
);

-- Allow edge functions to mark tokens as confirmed during validation
CREATE POLICY "Edge functions can confirm tokens" 
ON public.email_confirmations 
FOR UPDATE 
USING (
  auth.jwt() ->> 'role' = 'service_role' AND
  expires_at > now() AND
  confirmed_at IS NULL
)
WITH CHECK (
  -- Only allow setting confirmed_at timestamp
  confirmed_at IS NOT NULL
);

-- Allow system to create new confirmation tokens for resend functionality
CREATE POLICY "Edge functions can create tokens" 
ON public.email_confirmations 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
);