-- Skapa tabell för bekräftelsetokens
CREATE TABLE public.email_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '5 minutes'),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index för snabba lookups
CREATE INDEX idx_email_confirmations_token ON public.email_confirmations(token);
CREATE INDEX idx_email_confirmations_expires ON public.email_confirmations(expires_at);

-- Funktion för att rensa gamla bekräftelser
CREATE OR REPLACE FUNCTION public.cleanup_expired_confirmations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ta bort obekräftade användare vars bekräftelsetid gått ut
  DELETE FROM auth.users 
  WHERE id IN (
    SELECT user_id 
    FROM public.email_confirmations 
    WHERE expires_at < now() 
    AND confirmed_at IS NULL
  );
  
  -- Ta bort utgångna bekräftelser
  DELETE FROM public.email_confirmations 
  WHERE expires_at < now() 
  AND confirmed_at IS NULL;
END;
$$;