
-- Fix search_path på återstående funktioner
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- Realtime channels: kräv autentisering för att prenumerera på privata topics.
-- Vi använder postgres_changes (skyddat via table-RLS), inte broadcast/presence,
-- så detta är en defensiv baseline som blockerar oinloggade utan att bryta något.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='realtime' AND c.relname='messages' AND c.relrowsecurity
  ) THEN
    DROP POLICY IF EXISTS "authenticated_can_receive_broadcasts" ON realtime.messages;
    CREATE POLICY "authenticated_can_receive_broadcasts"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
