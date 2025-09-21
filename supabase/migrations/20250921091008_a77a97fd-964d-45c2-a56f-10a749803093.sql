-- Fix handle_new_user function to use correct enum type
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    role,
    first_name,
    last_name,
    company_name,
    org_number,
    industry,
    address,
    website,
    company_description,
    employee_count
  )
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'jobseeker'::user_role),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'org_number',
    NEW.raw_user_meta_data->>'industry',
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'website',
    NEW.raw_user_meta_data->>'company_description',
    NEW.raw_user_meta_data->>'employee_count'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;