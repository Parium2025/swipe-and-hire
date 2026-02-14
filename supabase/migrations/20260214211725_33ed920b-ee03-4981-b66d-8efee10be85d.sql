-- Add notification trigger for job seekers when they submit an application
CREATE OR REPLACE FUNCTION public.notify_applicant_application_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
BEGIN
  -- Check if the applicant has this notification type enabled
  IF NOT is_notification_enabled(NEW.applicant_id, 'application_status') THEN
    RETURN NEW;
  END IF;

  -- Get job title and company name
  SELECT jp.title, COALESCE(p.company_name, CONCAT(p.first_name, ' ', p.last_name))
  INTO v_job_title, v_company_name
  FROM job_postings jp
  JOIN profiles p ON p.user_id = jp.employer_id
  WHERE jp.id = NEW.job_id;

  INSERT INTO notifications (user_id, type, title, body, metadata)
  VALUES (
    NEW.applicant_id,
    'application_status',
    'Ansökan skickad ✓',
    'Din ansökan till "' || COALESCE(v_job_title, 'Okänd tjänst') || '" hos ' || COALESCE(v_company_name, 'företaget') || ' har mottagits.',
    jsonb_build_object('job_id', NEW.job_id, 'application_id', NEW.id, 'route', '/my-applications')
  );

  RETURN NEW;
END;
$$;

-- Create the trigger on job_applications INSERT
CREATE TRIGGER notify_applicant_on_application
  AFTER INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_applicant_application_submitted();