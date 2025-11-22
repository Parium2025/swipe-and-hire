-- Update handle_new_user function to include company_name for employer accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    role, 
    first_name, 
    last_name,
    company_name
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'job_seeker')::public.user_role,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'company_name'
  );
  RETURN NEW;
END;
$function$;