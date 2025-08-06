-- Lägg till PIN-kod support för email-bekräftelse
ALTER TABLE public.email_confirmations 
ADD COLUMN pin_code VARCHAR(6),
ADD COLUMN pin_attempts INTEGER DEFAULT 0,
ADD COLUMN pin_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 hour');