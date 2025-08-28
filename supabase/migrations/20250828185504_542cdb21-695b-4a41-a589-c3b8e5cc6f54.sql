-- Check current policies and fix any gaps in email confirmations security
-- First, let's see what policies currently exist

-- Drop and recreate the policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view their own email confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can update their own email confirmations" ON public.email_confirmations;

-- Recreate the policies with proper security
CREATE POLICY "Users can view their own email confirmations" 
ON public.email_confirmations 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own email confirmations" 
ON public.email_confirmations 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Ensure no other overly permissive policies exist
-- INSERT and DELETE should only be available to super admins via the existing policy