CREATE OR REPLACE FUNCTION public.verify_cron_secret(_token text, _secret_name text DEFAULT 'email_queue_service_role_key')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = _secret_name
      AND decrypted_secret = _token
      AND _token IS NOT NULL
      AND length(_token) >= 32
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_secret(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text, text) TO service_role;