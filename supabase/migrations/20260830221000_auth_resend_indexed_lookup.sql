-- Service-role lookup used by the resend Edge Function. auth.users is managed
-- by Supabase, so application migrations must not create indexes there. The
-- managed unique partial index users_email_partial_key already covers the
-- normalized non-SSO lookup below because project emails are stored lowercase.

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
    AND u.is_sso_user = false
    AND u.email = lower(btrim(_email))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_auth_email_for_resend(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_auth_email_for_resend(text) TO service_role;

COMMENT ON FUNCTION public.lookup_auth_email_for_resend(text) IS
  'Service-role-only normalized auth lookup for confirmation resend; never expose to browser roles.';
