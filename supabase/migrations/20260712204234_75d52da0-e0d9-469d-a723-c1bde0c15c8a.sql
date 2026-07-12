
-- 1. Re-add the "authenticated can view employer rows" policy so display paths keep working
CREATE POLICY "Authenticated users can view employer basic info"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (role = 'employer');

-- 2. REVOKE the sensitive columns from anon + authenticated so no policy can
--    ever expose them cross-row. Own-user access uses get_my_profile() below.
REVOKE SELECT (phone, email, org_number, address, postal_code, home_location, birth_date)
  ON public.profiles FROM authenticated;
REVOKE SELECT (phone, email, org_number, address, postal_code, home_location, birth_date)
  ON public.profiles FROM anon;

-- 3. Full-row access to caller's OWN profile (bypasses column REVOKE via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
