-- Fix security vulnerabilities in email_confirmations table - Cascade version

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Users can view only their own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can create only their own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can update only their own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can securely view own confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can create own email confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can update own email confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Block all user deletes on confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "System can delete expired confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "System can cleanup expired confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Secure view own confirmations only" ON public.email_confirmations;
DROP POLICY IF EXISTS "Secure create own confirmations only" ON public.email_confirmations;
DROP POLICY IF EXISTS "Secure update own confirmations only" ON public.email_confirmations;
DROP POLICY IF EXISTS "Block user deletes completely" ON public.email_confirmations;
DROP POLICY IF EXISTS "Allow system cleanup only" ON public.email_confirmations;

-- Drop existing functions with CASCADE
DROP FUNCTION IF EXISTS public.can_access_confirmation_data(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_confirmation_owner(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_cleanup_confirmations() CASCADE;
DROP FUNCTION IF EXISTS public.validate_confirmation_token(uuid) CASCADE;

-- Create secure access control function
CREATE OR REPLACE FUNCTION public.is_confirmation_owner(confirmation_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT confirmation_user_id IS NOT NULL 
    AND auth.uid() IS NOT NULL 
    AND confirmation_user_id = auth.uid();
$$;

-- Create system cleanup function
CREATE OR REPLACE FUNCTION public.can_cleanup_confirmations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NULL OR is_super_admin(auth.uid());
$$;

-- Create new secure RLS policies with unique names
CREATE POLICY "email_confirmations_secure_select"
ON public.email_confirmations
FOR SELECT
TO authenticated
USING (is_confirmation_owner(user_id));

CREATE POLICY "email_confirmations_secure_insert"
ON public.email_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND user_id IS NOT NULL 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "email_confirmations_secure_update"
ON public.email_confirmations
FOR UPDATE  
TO authenticated
USING (is_confirmation_owner(user_id))
WITH CHECK (
  user_id = auth.uid() 
  AND user_id IS NOT NULL
);

CREATE POLICY "email_confirmations_block_user_delete"
ON public.email_confirmations
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "email_confirmations_system_cleanup"
ON public.email_confirmations  
FOR DELETE
TO service_role
USING (
  confirmed_at IS NULL 
  AND expires_at < now()
);

-- Add security monitoring function
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
  SELECT ec.user_id, ec.email, ec.expires_at, ec.confirmed_at
  INTO token_record
  FROM public.email_confirmations ec
  WHERE ec.token = input_token
    AND ec.expires_at > now()
    AND ec.confirmed_at IS NULL;
  
  IF FOUND THEN
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