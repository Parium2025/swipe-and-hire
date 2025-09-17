-- Complete security fix for email_confirmations - Clean slate approach

-- Temporarily disable RLS to ensure clean removal
ALTER TABLE public.email_confirmations DISABLE ROW LEVEL SECURITY;

-- Drop ALL functions that might be related (with CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS public.can_access_confirmation_data CASCADE;
DROP FUNCTION IF EXISTS public.is_confirmation_owner CASCADE;
DROP FUNCTION IF EXISTS public.can_cleanup_confirmations CASCADE;
DROP FUNCTION IF EXISTS public.validate_confirmation_token CASCADE;
DROP FUNCTION IF EXISTS public.log_confirmation_access CASCADE;

-- Re-enable RLS
ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;

-- Create new secure functions
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

CREATE OR REPLACE FUNCTION public.can_cleanup_confirmations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NULL OR is_super_admin(auth.uid());
$$;

-- Create secure RLS policies
CREATE POLICY "Users can view only their own confirmations"
ON public.email_confirmations
FOR SELECT
TO authenticated
USING (is_confirmation_owner(user_id));

CREATE POLICY "Users can create only their own confirmations"
ON public.email_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND user_id IS NOT NULL 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update only their own confirmations"
ON public.email_confirmations
FOR UPDATE  
TO authenticated
USING (is_confirmation_owner(user_id))
WITH CHECK (
  user_id = auth.uid() 
  AND user_id IS NOT NULL
);

CREATE POLICY "Block all user deletes on confirmations"
ON public.email_confirmations
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "System can cleanup expired confirmations"
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