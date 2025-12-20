-- Skapa funktion för att uppdatera applications_count
CREATE OR REPLACE FUNCTION public.update_job_applications_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Öka räknaren när en ny ansökan skapas
    UPDATE job_postings 
    SET applications_count = COALESCE(applications_count, 0) + 1
    WHERE id = NEW.job_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Minska räknaren när en ansökan tas bort
    UPDATE job_postings 
    SET applications_count = GREATEST(COALESCE(applications_count, 0) - 1, 0)
    WHERE id = OLD.job_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Skapa trigger för INSERT
DROP TRIGGER IF EXISTS trigger_increment_applications_count ON job_applications;
CREATE TRIGGER trigger_increment_applications_count
AFTER INSERT ON job_applications
FOR EACH ROW
EXECUTE FUNCTION update_job_applications_count();

-- Skapa trigger för DELETE
DROP TRIGGER IF EXISTS trigger_decrement_applications_count ON job_applications;
CREATE TRIGGER trigger_decrement_applications_count
AFTER DELETE ON job_applications
FOR EACH ROW
EXECUTE FUNCTION update_job_applications_count();

-- Synkronisera befintliga räknare med faktiska ansökningar
UPDATE job_postings jp
SET applications_count = (
  SELECT COUNT(*) 
  FROM job_applications ja 
  WHERE ja.job_id = jp.id
);