-- Fix search path for handle_new_user function to resolve security warning
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new profile with data from user metadata
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    phone,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name', 
    NEW.raw_user_meta_data ->> 'phone',
    (NEW.raw_user_meta_data ->> 'role')::public.app_role,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';