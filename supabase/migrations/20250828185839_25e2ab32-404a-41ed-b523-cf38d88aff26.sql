-- Fix function security warning by setting search_path
CREATE OR REPLACE FUNCTION public.grant_profile_access_on_application()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Grant profile access to the employer when someone applies to their job
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
    now() + interval '90 days' -- Access expires after 90 days
  FROM public.job_postings jp
  WHERE jp.id = NEW.job_id
  ON CONFLICT (job_seeker_id, employer_id, job_posting_id) 
  DO UPDATE SET 
    is_active = true,
    expires_at = now() + interval '90 days';
  
  RETURN NEW;
END;
$$;