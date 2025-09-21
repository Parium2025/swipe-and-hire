-- Add secure SELECT policies for email_confirmations table
-- Users should only be able to read their own confirmation records for validation

-- Policy: Users can only view their own confirmations for validation purposes
CREATE POLICY "Users can view own confirmations for validation" 
ON public.email_confirmations 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Policy: Allow system/service role to read confirmations for processing
CREATE POLICY "Service role can read confirmations" 
ON public.email_confirmations 
FOR SELECT 
TO service_role
USING (true);

-- Policy: Super admins can view confirmations for support purposes
CREATE POLICY "Super admins can view confirmations" 
ON public.email_confirmations 
FOR SELECT 
TO authenticated
USING (is_super_admin(auth.uid()));