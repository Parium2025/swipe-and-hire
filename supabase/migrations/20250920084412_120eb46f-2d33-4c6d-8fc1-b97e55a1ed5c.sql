-- FIXA SECURITY DEFINER VIEW PROBLEMET
-- Ta bort den problematiska view:n som använder SECURITY DEFINER

DROP VIEW IF EXISTS public.email_confirmations_safe;

-- Istället använder vi bara de säkra funktionerna som redan skapats:
-- public.get_confirmation_status(user_uuid) 
-- public.has_pending_confirmation(user_uuid)

-- Dessa funktioner ger säker åtkomst till confirmation status utan att exponera känsliga tokens