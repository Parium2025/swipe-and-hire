-- Fix security issue with email_confirmations table access

-- First, drop the existing overly permissive policy
DROP POLICY IF EXISTS "Controlled admin access to confirmations" ON public.email_confirmations;

-- Users can only view their own confirmations
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
DROP POLICY IF EXISTS "Users can update their own email confirmations" ON public.email_confirmations;
CREATE POLICY "Users can update own email confirmations" 
ON public.email_confirmations 
FOR UPDATE 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- Only allow system/service role to delete confirmations
CREATE POLICY "System can delete expired confirmations" 
ON public.email_confirmations 
FOR DELETE 
USING (false);