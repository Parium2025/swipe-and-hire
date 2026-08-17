DROP TRIGGER IF EXISTS trg_notify_employer_new_application ON public.job_applications;
DROP FUNCTION IF EXISTS public.notify_employer_new_application();

CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
  v_applicant_name TEXT;
  v_employer_id UUID;
  v_in_app BOOLEAN;
BEGIN
  SELECT title, employer_id INTO v_job_title, v_employer_id
  FROM job_postings WHERE id = NEW.job_id;

  IF v_employer_id IS NULL OR v_employer_id = NEW.applicant_id THEN
    RETURN NEW;
  END IF;

  IF NOT is_notification_enabled(v_employer_id, 'new_application') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(in_app_enabled, true) INTO v_in_app
  FROM public.notification_preferences
  WHERE user_id = v_employer_id AND notification_type = 'new_application';

  IF v_in_app IS FALSE THEN
    RETURN NEW;
  END IF;

  v_applicant_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  IF v_applicant_name = '' THEN v_applicant_name := 'En kandidat'; END IF;

  INSERT INTO notifications (user_id, type, title, body, metadata)
  VALUES (
    v_employer_id,
    'new_application',
    'Ny ansökan',
    v_applicant_name || ' har sökt tjänsten ' || COALESCE(v_job_title, 'Okänd tjänst'),
    jsonb_build_object('job_id', NEW.job_id, 'application_id', NEW.id, 'applicant_id', NEW.applicant_id, 'route', '/candidates')
  );

  RETURN NEW;
END;
$$;