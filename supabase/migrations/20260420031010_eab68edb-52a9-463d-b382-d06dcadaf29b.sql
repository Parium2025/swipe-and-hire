-- Fix trigger to fire on logo changes too, not just company_name
DROP TRIGGER IF EXISTS sync_company_name_to_jobs_trigger ON public.profiles;

CREATE TRIGGER sync_company_name_to_jobs_trigger
AFTER UPDATE OF company_name, company_logo_url ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_name_to_jobs();