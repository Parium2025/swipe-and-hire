-- Fixa säkerhetsproblem från förra migrationen
-- 1. Aktivera RLS på email_confirmations tabellen
ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;

-- 2. Skapa RLS policies för email_confirmations
CREATE POLICY "Super admins can manage all confirmations" 
ON public.email_confirmations 
FOR ALL 
USING (is_super_admin(auth.uid()));

-- 3. Fixa search_path för cleanup_expired_confirmations funktionen
CREATE OR REPLACE FUNCTION public.cleanup_expired_confirmations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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