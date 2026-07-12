
-- 1. Drop the over-broad policy
DROP POLICY IF EXISTS "Authenticated users can view employer basic info" ON public.profiles;

-- 2. Create a SECURITY DEFINER function returning ONLY safe employer fields
CREATE OR REPLACE FUNCTION public.get_employer_public_profile(target_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  company_name text,
  company_logo_url text,
  company_description text,
  website text,
  industry text,
  employee_count text,
  address text,
  first_name text,
  last_name text,
  role user_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.company_name, p.company_logo_url, p.company_description,
         p.website, p.industry, p.employee_count, p.address,
         p.first_name, p.last_name, p.role
  FROM public.profiles p
  WHERE p.user_id = target_user_id
    AND p.role = 'employer';
$$;

REVOKE ALL ON FUNCTION public.get_employer_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employer_public_profile(uuid) TO anon, authenticated;

-- 3. Bulk variant for lists (e.g. multiple companies at once)
CREATE OR REPLACE FUNCTION public.get_employer_public_profiles(target_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  company_name text,
  company_logo_url text,
  company_description text,
  website text,
  industry text,
  employee_count text,
  address text,
  first_name text,
  last_name text,
  role user_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.company_name, p.company_logo_url, p.company_description,
         p.website, p.industry, p.employee_count, p.address,
         p.first_name, p.last_name, p.role
  FROM public.profiles p
  WHERE p.user_id = ANY(target_user_ids)
    AND p.role = 'employer';
$$;

REVOKE ALL ON FUNCTION public.get_employer_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employer_public_profiles(uuid[]) TO anon, authenticated;
