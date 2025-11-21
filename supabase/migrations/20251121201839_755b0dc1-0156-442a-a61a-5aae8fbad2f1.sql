-- Add unique constraint on user_id to enable UPSERT in resend-confirmation
-- This fixes the "there is no unique or exclusion constraint" error
ALTER TABLE email_confirmations 
ADD CONSTRAINT email_confirmations_user_id_key UNIQUE (user_id);