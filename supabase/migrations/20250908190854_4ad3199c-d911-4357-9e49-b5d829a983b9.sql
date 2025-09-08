-- Add security indexes for email confirmations
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_confirmations_token ON public.email_confirmations(token);

-- Add constraint to prevent duplicate active confirmations per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_confirmations_active_user 
ON public.email_confirmations(user_id) 
WHERE confirmed_at IS NULL;