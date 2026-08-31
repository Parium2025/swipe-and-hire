-- Additive lookup used only by service-role Edge Functions. This removes the
-- O(number of auth users) admin.listUsers scan from confirmation resends.
CREATE INDEX IF NOT EXISTS auth_users_email_normalized_lookup_idx
  ON auth.users (lower(email))
  WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.lookup_auth_email_for_resend(_email text)
RETURNS TABLE (
  user_id uuid,
  email_confirmed boolean,
  account_role text,
  first_name text,
  company_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    u.id,
    u.email_confirmed_at IS NOT NULL,
    CASE
      WHEN u.raw_user_meta_data ->> 'role' = 'employer' THEN 'employer'
      ELSE 'job_seeker'
    END,
    NULLIF(btrim(u.raw_user_meta_data ->> 'first_name'), ''),
    NULLIF(btrim(u.raw_user_meta_data ->> 'company_name'), '')
  FROM auth.users AS u
  WHERE NULLIF(btrim(_email), '') IS NOT NULL
    AND lower(u.email) = lower(btrim(_email))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_auth_email_for_resend(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_auth_email_for_resend(text) TO service_role;

COMMENT ON FUNCTION public.lookup_auth_email_for_resend(text) IS
  'Service-role-only normalized auth lookup for confirmation resend; never expose to browser roles.';
