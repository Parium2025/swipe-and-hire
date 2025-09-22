-- Tighten email_confirmations access: remove service role SELECT policies (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role limited token access" ON public.email_confirmations;
DROP POLICY IF EXISTS "Service role validation restricted" ON public.email_confirmations;

-- Keep existing super admin SELECT policy and user INSERT/UPDATE policies intact
-- No changes to data or columns; only RLS hardening
