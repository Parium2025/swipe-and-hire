-- Drop all existing triggers first
DROP TRIGGER IF EXISTS trigger_increment_applications_count ON job_applications;
DROP TRIGGER IF EXISTS trigger_decrement_applications_count ON job_applications;
DROP TRIGGER IF EXISTS trigger_update_applications_count ON job_applications;

-- Drop the function with CASCADE to be safe
DROP FUNCTION IF EXISTS update_job_applications_count() CASCADE;

-- Create simplified function that only handles INSERT
CREATE OR REPLACE FUNCTION public.update_job_applications_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE job_postings 
  SET applications_count = COALESCE(applications_count, 0) + 1
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$function$;

-- Create trigger only for INSERT
CREATE TRIGGER trigger_update_applications_count
AFTER INSERT ON job_applications
FOR EACH ROW
EXECUTE FUNCTION update_job_applications_count();