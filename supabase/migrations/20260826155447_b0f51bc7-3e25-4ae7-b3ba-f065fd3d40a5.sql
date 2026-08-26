DROP FUNCTION IF EXISTS public.get_employer_public_profile(uuid);
CREATE FUNCTION public.get_employer_public_profile(target_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  company_name text,
  company_logo_url text,
  company_description text,
  website text,
  industry text,
  employee_count text,
  address text,
  org_number text,
  company_social_media_links json,
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
         p.org_number, p.company_social_media_links,
         p.first_name, p.last_name, p.role
  FROM public.profiles p
  WHERE p.user_id = target_user_id
    AND p.role = 'employer';
$$;

REVOKE ALL ON FUNCTION public.get_employer_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employer_public_profile(uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_employer_public_profiles(uuid[]);
CREATE FUNCTION public.get_employer_public_profiles(target_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  company_name text,
  company_logo_url text,
  company_description text,
  website text,
  industry text,
  employee_count text,
  address text,
  org_number text,
  company_social_media_links json,
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
         p.org_number, p.company_social_media_links,
         p.first_name, p.last_name, p.role
  FROM public.profiles p
  WHERE p.user_id = ANY(target_user_ids)
    AND p.role = 'employer';
$$;

REVOKE ALL ON FUNCTION public.get_employer_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employer_public_profiles(uuid[]) TO anon, authenticated;