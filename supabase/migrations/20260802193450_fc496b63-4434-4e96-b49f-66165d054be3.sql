CREATE OR REPLACE FUNCTION public.auth_email_registered(_email text)
RETURNS TABLE (exists_flag boolean, user_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true,
         (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id LIMIT 1)
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(_email))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.auth_email_registered(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_registered(text) TO service_role;