-- Update the handle_new_user function to sync all employer fields from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    role,
    company_name,
    org_number,
    industry,
    address,
    website,
    company_description,
    employee_count,
    phone
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    COALESCE((new.raw_user_meta_data ->> 'role')::user_role, 'job_seeker'),
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'org_number',
    new.raw_user_meta_data ->> 'industry',
    new.raw_user_meta_data ->> 'address',
    new.raw_user_meta_data ->> 'website',
    new.raw_user_meta_data ->> 'company_description',
    new.raw_user_meta_data ->> 'employee_count',
    new.raw_user_meta_data ->> 'phone'
  );
  RETURN new;
END;
$$;

-- Also sync existing employer profiles from user_metadata
-- This is a one-time fix for users who registered before this migration
UPDATE public.profiles p
SET 
  company_description = COALESCE(p.company_description, (
    SELECT raw_user_meta_data ->> 'company_description' 
    FROM auth.users u WHERE u.id = p.user_id
  )),
  website = COALESCE(p.website, (
    SELECT raw_user_meta_data ->> 'website' 
    FROM auth.users u WHERE u.id = p.user_id
  )),
  industry = COALESCE(p.industry, (
    SELECT raw_user_meta_data ->> 'industry' 
    FROM auth.users u WHERE u.id = p.user_id
  )),
  address = COALESCE(p.address, (
    SELECT raw_user_meta_data ->> 'address' 
    FROM auth.users u WHERE u.id = p.user_id
  )),
  employee_count = COALESCE(p.employee_count, (
    SELECT raw_user_meta_data ->> 'employee_count' 
    FROM auth.users u WHERE u.id = p.user_id
  )),
  org_number = COALESCE(p.org_number, (
    SELECT raw_user_meta_data ->> 'org_number' 
    FROM auth.users u WHERE u.id = p.user_id
  ))
WHERE p.role = 'employer';