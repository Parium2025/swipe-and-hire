-- Create function to handle new user registration and create profile
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();