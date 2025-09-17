-- Fix security vulnerabilities in email_confirmations table - Corrected version

-- First, drop ALL existing policies with their actual names
DROP POLICY IF EXISTS "Users can view only their own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can securely view own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can create own email confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can create only their own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can update own email confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can update only their own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Block all user deletes on confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "System can delete expired confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "System can cleanup expired confirmations" ON public.email_confirmations;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.can_access_confirmation_data(uuid);
DROP FUNCTION IF EXISTS public.is_confirmation_owner(uuid);
DROP FUNCTION IF EXISTS public.can_cleanup_confirmations();
DROP FUNCTION IF EXISTS public.log_confirmation_access();
DROP FUNCTION IF EXISTS public.validate_confirmation_token(uuid);

-- Create a more secure access control function with proper validation
CREATE OR REPLACE FUNCTION public.is_confirmation_owner(confirmation_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only return true if user is authenticated and owns the confirmation
  SELECT confirmation_user_id IS NOT NULL 
    AND auth.uid() IS NOT NULL 
    AND confirmation_user_id = auth.uid();
$$;

-- Create a function for system-level cleanup operations
CREATE OR REPLACE FUNCTION public.can_cleanup_confirmations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only allow system cleanup operations (when no user is authenticated)
  SELECT auth.uid() IS NULL OR is_super_admin(auth.uid());
$$;

-- Create NEW restrictive RLS policies with unique names

-- Users can only view their own confirmations and only if authenticated
CREATE POLICY "Secure view own confirmations only"
ON public.email_confirmations
FOR SELECT
TO authenticated
USING (is_confirmation_owner(user_id));

-- Users can only create confirmations for themselves
CREATE POLICY "Secure create own confirmations only"
ON public.email_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND user_id IS NOT NULL 
  AND auth.uid() IS NOT NULL
);

-- Users can only update their own confirmations (e.g., for PIN attempts)
CREATE POLICY "Secure update own confirmations only"
ON public.email_confirmations
FOR UPDATE  
TO authenticated
USING (is_confirmation_owner(user_id))
WITH CHECK (
  user_id = auth.uid() 
  AND user_id IS NOT NULL
);

-- Completely block user deletes - only system can delete
CREATE POLICY "Block all user deletes secure"
ON public.email_confirmations
FOR DELETE
TO authenticated
USING (false);

-- Allow system cleanup of expired confirmations
CREATE POLICY "System cleanup expired secure"
ON public.email_confirmations  
FOR DELETE
TO service_role
USING (
  confirmed_at IS NULL 
  AND expires_at < now()
);

-- Add additional security: Create a function to validate token access patterns
CREATE OR REPLACE FUNCTION public.log_confirmation_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log all access attempts for security monitoring
  IF TG_OP = 'SELECT' THEN
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      table_name,
      record_id,
      metadata
    ) VALUES (
      auth.uid(),
      'confirmation_token_accessed',
      'email_confirmations',
      NEW.id,
      jsonb_build_object(
        'token_id', NEW.id,
        'user_id', NEW.user_id,
        'access_time', now(),
        'expires_at', NEW.expires_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add a function to securely validate confirmation tokens
CREATE OR REPLACE FUNCTION public.validate_confirmation_token(input_token uuid)
RETURNS TABLE(
  is_valid boolean,
  user_id uuid,
  email text,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_record record;
BEGIN
  -- Find the token and validate it
  SELECT ec.user_id, ec.email, ec.expires_at, ec.confirmed_at
  INTO token_record
  FROM public.email_confirmations ec
  WHERE ec.token = input_token
    AND ec.expires_at > now()
    AND ec.confirmed_at IS NULL;
  
  IF FOUND THEN
    -- Log the validation attempt
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      table_name,
      metadata
    ) VALUES (
      token_record.user_id,
      'token_validation_success',
      'email_confirmations',
      jsonb_build_object(
        'token', input_token,
        'validation_time', now()
      )
    );
    
    RETURN QUERY SELECT true, token_record.user_id, token_record.email, token_record.expires_at;
  ELSE
    -- Log failed validation attempts
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      table_name,
      metadata
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'token_validation_failed',
      'email_confirmations',
      jsonb_build_object(
        'token', input_token,
        'validation_time', now(),
        'reason', 'token_not_found_or_expired'
      )
    );
    
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::timestamp with time zone;
  END IF;
END;
$$;