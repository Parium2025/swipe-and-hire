-- Uppdatera funktionen för att ge permanent access vid jobbansökan
-- istället för tidsbegränsad access
CREATE OR REPLACE FUNCTION public.grant_limited_profile_access_on_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Grant PERMANENT profile access to employer when someone applies to their job
  -- No expiration - access remains until manually revoked by job seeker
  INSERT INTO public.profile_view_permissions (
    job_seeker_id, 
    employer_id, 
    job_posting_id,
    permission_type,
    expires_at
  )
  SELECT 
    NEW.applicant_id,
    jp.employer_id,
    NEW.job_id,
    'application_based',
    NULL -- NULL = permanent access, never expires
  FROM public.job_postings jp
  WHERE jp.id = NEW.job_id
  ON CONFLICT (job_seeker_id, employer_id, job_posting_id) 
  DO UPDATE SET 
    is_active = true,
    expires_at = NULL; -- Ensure it's permanent even if updating existing permission
  
  RETURN NEW;
END;
$function$;

-- Uppdatera beskrivningen av cleanup-funktionen för att förtydliga
-- att den INTE kommer ta bort application-based permissions (eftersom de är permanenta)
COMMENT ON FUNCTION public.cleanup_expired_profile_permissions() IS 
'Deactivates expired profile permissions. Application-based permissions with NULL expires_at are permanent and never cleaned up.';
