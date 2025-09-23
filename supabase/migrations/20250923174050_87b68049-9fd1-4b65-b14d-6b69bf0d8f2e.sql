-- Remove Anatoli's profile completely so he can register fresh
DELETE FROM public.profiles WHERE user_id = '5a969b33-68f2-44d7-932b-14e59364e66d';
DELETE FROM public.user_roles WHERE user_id = '5a969b33-68f2-44d7-932b-14e59364e66d';
DELETE FROM public.user_data_consents WHERE user_id = '5a969b33-68f2-44d7-932b-14e59364e66d';

-- Fix the validation function to only validate job seekers properly
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only validate for job seeker profiles, skip validation for employers
  IF NEW.role = 'job_seeker' THEN
    -- Validate the profile data only if fields are being set
    IF NOT public.validate_profile_data(NEW.birth_date, NEW.phone, NEW.cv_url) THEN
      RAISE EXCEPTION 'Invalid profile data provided';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Re-enable the validation trigger with the fixed function
DROP TRIGGER IF EXISTS validate_profile_trigger ON public.profiles;
CREATE TRIGGER validate_profile_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_update();