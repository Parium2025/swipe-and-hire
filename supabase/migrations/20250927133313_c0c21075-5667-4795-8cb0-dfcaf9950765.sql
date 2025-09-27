-- Create function to automatically populate application with profile data
CREATE OR REPLACE FUNCTION public.populate_application_from_profile()
RETURNS TRIGGER AS $$
DECLARE
  profile_data RECORD;
BEGIN
  -- Get profile data for the applicant
  SELECT 
    p.first_name,
    p.last_name,
    calculate_age(p.birth_date) as age,
    au.email,
    p.phone,
    COALESCE(p.home_location, p.location) as location,
    p.bio,
    p.cv_url,
    p.employment_status,
    p.availability
  INTO profile_data
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.user_id
  WHERE p.user_id = NEW.applicant_id;
  
  -- Auto-populate fields if not already set
  NEW.first_name := COALESCE(NEW.first_name, profile_data.first_name);
  NEW.last_name := COALESCE(NEW.last_name, profile_data.last_name);
  NEW.age := COALESCE(NEW.age, profile_data.age);
  NEW.email := COALESCE(NEW.email, profile_data.email);
  NEW.phone := COALESCE(NEW.phone, profile_data.phone);
  NEW.location := COALESCE(NEW.location, profile_data.location);
  NEW.bio := COALESCE(NEW.bio, profile_data.bio);
  NEW.cv_url := COALESCE(NEW.cv_url, profile_data.cv_url);
  NEW.employment_status := COALESCE(NEW.employment_status, profile_data.employment_status);
  NEW.availability := COALESCE(NEW.availability, profile_data.availability);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS populate_application_profile_data ON public.job_applications;

-- Create trigger for automatic profile data population
CREATE TRIGGER populate_application_profile_data
  BEFORE INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_application_from_profile();