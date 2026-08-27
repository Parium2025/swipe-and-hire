DROP POLICY IF EXISTS "Users can view their own confirmations" ON public.email_confirmations;
REVOKE SELECT ON public.email_confirmations FROM authenticated;