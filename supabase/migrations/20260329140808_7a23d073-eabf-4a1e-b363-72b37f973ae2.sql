CREATE OR REPLACE FUNCTION public.notify_interview_scheduled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job_title TEXT;
  v_candidate_name TEXT;
BEGIN
  -- Notify candidate
  IF is_notification_enabled(NEW.applicant_id, 'interview_scheduled') THEN
    SELECT title INTO v_job_title FROM job_postings WHERE id = NEW.job_id;

    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      NEW.applicant_id,
      'interview_scheduled',
      'Intervju inbokad',
      'Du har en intervju inbokad för ' || COALESCE(v_job_title, 'en tjänst') || ' den ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Stockholm', 'DD Mon YYYY HH24:MI'),
      jsonb_build_object('job_id', NEW.job_id, 'interview_id', NEW.id, 'route', '/my-applications')
    );
  END IF;

  -- Notify employer
  IF is_notification_enabled(NEW.employer_id, 'interview_scheduled') THEN
    IF v_job_title IS NULL THEN
      SELECT title INTO v_job_title FROM job_postings WHERE id = NEW.job_id;
    END IF;

    SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    INTO v_candidate_name
    FROM job_applications
    WHERE applicant_id = NEW.applicant_id AND job_id = NEW.job_id
    LIMIT 1;

    IF v_candidate_name IS NULL OR v_candidate_name = '' THEN
      v_candidate_name := 'En kandidat';
    END IF;

    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      NEW.employer_id,
      'interview_scheduled',
      'Intervju bokad',
      'Intervju med ' || v_candidate_name || ' för ' || COALESCE(v_job_title, 'en tjänst') || ' den ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Stockholm', 'DD Mon YYYY HH24:MI'),
      jsonb_build_object('job_id', NEW.job_id, 'interview_id', NEW.id, 'applicant_id', NEW.applicant_id, 'route', '/employer')
    );
  END IF;

  RETURN NEW;
END;
$function$;