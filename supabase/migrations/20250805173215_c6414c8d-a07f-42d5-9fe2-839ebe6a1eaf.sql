-- Add unique constraint on user_id for email_confirmations table
ALTER TABLE public.email_confirmations ADD CONSTRAINT email_confirmations_user_id_unique UNIQUE (user_id);