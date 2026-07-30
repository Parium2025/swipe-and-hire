-- 1) Plattformsadmin != organisationsadmin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'admin'
      AND organization_id IS NULL
      AND COALESCE(is_active, true) = true
  )
$$;

-- 2) Supportsvar måste höra till ett verkligt ärende
DROP POLICY IF EXISTS "Admins can post admin replies" ON public.support_messages;
CREATE POLICY "Admins can post admin replies"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  AND EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = support_messages.ticket_id)
);

-- 3) Chattmotpart ska inte kunna läsa hela profilraden (PII).
--    Chatten använder redan get_conversation_summaries() / get_employer_public_profiles()
--    som är SECURITY DEFINER och returnerar endast namn, roll och bild.
DROP POLICY IF EXISTS "Conversation members can view each other profiles" ON public.profiles;

-- 4) Försvar på djupet: utloggade ska inte ha några skrivrättigheter någonstans.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

-- 5) Intern kandidatsökning ska inte vara anropbar av utloggade
REVOKE EXECUTE ON FUNCTION public.search_employer_candidates(text, jsonb, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_employer_candidates(text, jsonb, text, text, integer, integer) TO authenticated;