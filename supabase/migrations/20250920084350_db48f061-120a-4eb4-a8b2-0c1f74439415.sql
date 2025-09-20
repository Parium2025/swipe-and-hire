-- SÄKERHETSFIX FÖR EMAIL_CONFIRMATIONS TABELLEN
-- Problemet: Tabellen exponerar känsliga tokens, PIN-koder och email-adresser

-- 1. Skapa en säker vy som döljer känsliga fält
CREATE OR REPLACE VIEW public.email_confirmations_safe AS
SELECT 
  id,
  user_id,
  expires_at,
  confirmed_at,
  created_at,
  pin_expires_at,
  email,
  -- Exkludera känsliga fält: token, pin_code, pin_attempts
  CASE 
    WHEN confirmed_at IS NOT NULL THEN true 
    ELSE false 
  END as is_confirmed,
  CASE 
    WHEN expires_at > now() THEN true 
    ELSE false 
  END as is_expired
FROM public.email_confirmations;

-- 2. Blockera direkt SELECT-åtkomst till email_confirmations tabellen
-- Behåll bara de RLS-policies som är absolut nödvändiga för systemprocesser
DROP POLICY IF EXISTS "Users can view only their own confirmations" ON public.email_confirmations;

-- 3. Skapa en säker funktion för att kontrollera confirmation status
CREATE OR REPLACE FUNCTION public.get_confirmation_status(user_uuid uuid)
RETURNS TABLE(
  is_confirmed boolean,
  is_expired boolean,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Endast returnera status information, inte känsliga tokens
  RETURN QUERY
  SELECT 
    CASE WHEN ec.confirmed_at IS NOT NULL THEN true ELSE false END as is_confirmed,
    CASE WHEN ec.expires_at < now() THEN true ELSE false END as is_expired,
    ec.expires_at
  FROM public.email_confirmations ec
  WHERE ec.user_id = user_uuid
  ORDER BY ec.created_at DESC
  LIMIT 1;
END;
$$;

-- 4. Skapa funktion för att kontrollera om användare har pending confirmation
CREATE OR REPLACE FUNCTION public.has_pending_confirmation(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.email_confirmations 
    WHERE user_id = user_uuid 
      AND confirmed_at IS NULL 
      AND expires_at > now()
  );
END;
$$;

-- 5. Logga denna säkerhetsfix
INSERT INTO public.security_audit_log (
  user_id,
  action,
  table_name
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid, -- System user
  'security_fix_applied',
  'email_confirmations'
);