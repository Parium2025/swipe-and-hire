-- Replace handle_new_user to use public.user_role everywhere (fix 500 during signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role text;
  cast_role public.user_role;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';

  -- Safe cast with default to job_seeker
  BEGIN
    cast_role := COALESCE(meta_role::public.user_role, 'job_seeker'::public.user_role);
  EXCEPTION WHEN others THEN
    cast_role := 'job_seeker'::public.user_role;
  END;

  -- Create profile from metadata
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    phone,
    role,
    company_name,
    org_number,
    industry,
    address,
    website,
    company_description,
    employee_count,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name', 
    NEW.raw_user_meta_data ->> 'phone',
    cast_role,
    NEW.raw_user_meta_data ->> 'company_name',
    NEW.raw_user_meta_data ->> 'org_number',
    NEW.raw_user_meta_data ->> 'industry',
    NEW.raw_user_meta_data ->> 'address',
    NEW.raw_user_meta_data ->> 'website',
    NEW.raw_user_meta_data ->> 'company_description',
    NEW.raw_user_meta_data ->> 'employee_count',
    NOW(),
    NOW()
  );

  -- Insert initial user role if provided
  IF meta_role IS NOT NULL AND meta_role <> '' THEN
    INSERT INTO public.user_roles (
      user_id,
      role,
      organization_id,
      is_active,
      created_at
    ) VALUES (
      NEW.id,
      cast_role,
      NULLIF(NEW.raw_user_meta_data ->> 'organization_id', '')::uuid,
      true,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;