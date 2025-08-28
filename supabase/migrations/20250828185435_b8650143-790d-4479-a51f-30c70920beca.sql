-- Fix email confirmation tokens security vulnerability
-- Currently only super admins have access, but we need to ensure regular users can only access their own confirmations

-- Add policy for users to view only their own email confirmations
CREATE POLICY "Users can view their own email confirmations" 
ON public.email_confirmations 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Add policy for users to update only their own email confirmations (for marking as confirmed)
CREATE POLICY "Users can update their own email confirmations" 
ON public.email_confirmations 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Note: INSERT and DELETE operations should remain restricted to super admins and service role
-- since email confirmations are typically created by edge functions using service role