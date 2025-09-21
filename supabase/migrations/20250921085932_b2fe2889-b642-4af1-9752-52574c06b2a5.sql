-- Update handle_new_user function to handle employer data
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert new profile with data from user metadata
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
    (NEW.raw_user_meta_data ->> 'role')::public.app_role,
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

  -- Insert user role
  IF NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (
      user_id,
      role,
      organization_id,
      is_active,
      created_at
    ) VALUES (
      NEW.id,
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      (NEW.raw_user_meta_data ->> 'organization_id')::uuid,
      true,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$function$;