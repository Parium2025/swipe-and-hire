-- Fix security issue with email_confirmations table access

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Controlled admin access to confirmations" ON public.email_confirmations;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can update their own email confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Users can view their own email confirmations" ON public.email_confirmations;

-- Create restrictive policies for different operations

-- Users can only view their own confirmations (no admin access)
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
CREATE POLICY "Users can update own email confirmations" 
ON public.email_confirmations 
FOR UPDATE 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- Block all delete operations through RLS (only service role can delete)
CREATE POLICY "Block user deletes on confirmations" 
ON public.email_confirmations 
FOR DELETE 
USING (false);