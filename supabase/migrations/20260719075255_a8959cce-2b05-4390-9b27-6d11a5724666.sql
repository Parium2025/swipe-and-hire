
-- Hjälpfunktion: kolla om användaren är plattforms-admin
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
      AND COALESCE(is_active, true) = true
  )
$$;

-- 1) support_messages: stärk INSERT-policyn
DROP POLICY IF EXISTS "Users can create messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users can create messages on own tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Admins can post admin replies" ON public.support_messages;

CREATE POLICY "Users can create messages on own tickets"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(is_admin_reply, false) = false
  AND EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = support_messages.ticket_id
      AND st.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can post admin replies"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
);

-- 2) company_reviews: skydda hidden_author_id
REVOKE SELECT (hidden_author_id) ON public.company_reviews FROM anon, authenticated;
