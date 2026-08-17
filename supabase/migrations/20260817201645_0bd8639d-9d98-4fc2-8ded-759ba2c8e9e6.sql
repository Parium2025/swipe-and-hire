CREATE OR REPLACE FUNCTION public.is_in_app_notification_enabled(p_user_id uuid, p_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT COALESCE(is_enabled, true) AND COALESCE(in_app_enabled, true)
       FROM notification_preferences
      WHERE user_id = p_user_id AND notification_type = p_type),
    true
  );
$$;

REVOKE ALL ON FUNCTION public.is_in_app_notification_enabled(uuid, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job_title TEXT;
  v_applicant_name TEXT;
  v_employer_id UUID;
BEGIN
  SELECT title, employer_id INTO v_job_title, v_employer_id
  FROM job_postings WHERE id = NEW.job_id;

  IF v_employer_id IS NULL OR v_employer_id = NEW.applicant_id THEN
    RETURN NEW;
  END IF;

  IF NOT is_in_app_notification_enabled(v_employer_id, 'new_application') THEN
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

CREATE OR REPLACE FUNCTION public.notify_conversation_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  IF COALESCE(NEW.is_system_message, false) THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT cm.user_id
    FROM public.conversation_members cm
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.user_id <> NEW.sender_id
  LOOP
    IF is_in_app_notification_enabled(r.user_id, 'new_message') THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata)
      VALUES (
        r.user_id,
        'new_message',
        'Nytt meddelande',
        LEFT(COALESCE(NULLIF(TRIM(NEW.content), ''), 'Du har fått ett nytt meddelande'), 140),
        jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_applicant_application_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
BEGIN
  IF NOT is_in_app_notification_enabled(NEW.applicant_id, 'application_status') THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.notify_job_closed_to_applicants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_applicant RECORD;
BEGIN
  IF (OLD.is_active = true AND NEW.is_active = false)
     OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN

    FOR v_applicant IN
      SELECT DISTINCT applicant_id FROM job_applications WHERE job_id = NEW.id
    LOOP
      IF is_in_app_notification_enabled(v_applicant.applicant_id, 'job_closed') THEN
        INSERT INTO notifications (user_id, type, title, body, metadata)
        VALUES (
          v_applicant.applicant_id,
          'job_closed',
          'Annons avslutad',
          'Tjänsten "' || COALESCE(NEW.title, 'Okänd tjänst') || '" har avslutats.',
          jsonb_build_object('job_id', NEW.id, 'route', '/my-applications')
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_interview_scheduled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job_title TEXT;
  v_candidate_name TEXT;
  v_when TEXT;
  v_meta_candidate jsonb;
  v_meta_employer jsonb;
  v_body_candidate TEXT;
  v_body_employer TEXT;
BEGIN
  SELECT title INTO v_job_title FROM job_postings WHERE id = NEW.job_id;
  v_when := to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Stockholm', 'DD Mon YYYY HH24:MI');

  IF is_in_app_notification_enabled(NEW.applicant_id, 'interview_scheduled') THEN
    v_body_candidate := 'Du har en intervju inbokad för ' || COALESCE(v_job_title, 'en tjänst') || ' den ' || v_when;
    v_meta_candidate := jsonb_build_object('job_id', NEW.job_id, 'interview_id', NEW.id, 'route', '/my-applications');

    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (NEW.applicant_id, 'interview_scheduled', 'Intervju inbokad', v_body_candidate, v_meta_candidate);
  END IF;

  IF is_notification_enabled(NEW.applicant_id, 'interview_scheduled') THEN
    PERFORM dispatch_interview_push(
      NEW.applicant_id,
      'Intervju inbokad',
      'Du har en intervju inbokad för ' || COALESCE(v_job_title, 'en tjänst') || ' den ' || v_when,
      jsonb_build_object('job_id', NEW.job_id, 'interview_id', NEW.id, 'route', '/my-applications')
    );
  END IF;

  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  INTO v_candidate_name
  FROM job_applications
  WHERE applicant_id = NEW.applicant_id AND job_id = NEW.job_id
  LIMIT 1;

  IF v_candidate_name IS NULL OR v_candidate_name = '' THEN
    v_candidate_name := 'En kandidat';
  END IF;

  v_body_employer := 'Intervju med ' || v_candidate_name || ' för ' || COALESCE(v_job_title, 'en tjänst') || ' den ' || v_when;
  v_meta_employer := jsonb_build_object('job_id', NEW.job_id, 'interview_id', NEW.id, 'applicant_id', NEW.applicant_id, 'route', '/employer');

  IF is_in_app_notification_enabled(NEW.employer_id, 'interview_scheduled') THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (NEW.employer_id, 'interview_scheduled', 'Intervju bokad', v_body_employer, v_meta_employer);
  END IF;

  IF is_notification_enabled(NEW.employer_id, 'interview_scheduled') THEN
    PERFORM dispatch_interview_push(NEW.employer_id, 'Intervju bokad', v_body_employer, v_meta_employer);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_interview_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job_title TEXT;
  v_candidate_name TEXT;
  v_when TEXT;
  v_status_changed boolean;
  v_time_changed boolean;
  v_recipient uuid;
  v_actor uuid;
  v_actor_role text;
  v_title TEXT;
  v_body TEXT;
  v_meta jsonb;
BEGIN
  v_status_changed := (NEW.status IS DISTINCT FROM OLD.status);
  v_time_changed := (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at);

  IF NOT v_status_changed AND NOT v_time_changed THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF v_actor = NEW.applicant_id THEN
    v_actor_role := 'candidate';
    v_recipient := NEW.employer_id;
  ELSE
    v_actor_role := 'employer';
    v_recipient := NEW.applicant_id;
  END IF;

  SELECT title INTO v_job_title FROM job_postings WHERE id = NEW.job_id;
  v_when := to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Stockholm', 'DD Mon YYYY HH24:MI');

  SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  INTO v_candidate_name
  FROM job_applications
  WHERE applicant_id = NEW.applicant_id AND job_id = NEW.job_id
  LIMIT 1;

  IF v_candidate_name IS NULL OR v_candidate_name = '' THEN
    v_candidate_name := 'Kandidaten';
  END IF;

  IF v_status_changed THEN
    IF NEW.status = 'cancelled' THEN
      v_title := 'Intervju avbokad';
      IF v_actor_role = 'candidate' THEN
        v_body := v_candidate_name || ' avbokade intervjun för ' || COALESCE(v_job_title, 'en tjänst');
      ELSE
        v_body := 'Din intervju för ' || COALESCE(v_job_title, 'en tjänst') || ' har avbokats';
      END IF;
    ELSIF NEW.status = 'confirmed' THEN
      v_title := 'Intervju bekräftad';
      IF v_actor_role = 'candidate' THEN
        v_body := v_candidate_name || ' bekräftade intervjun för ' || COALESCE(v_job_title, 'en tjänst') || ' den ' || v_when;
      ELSE
        v_body := 'Din intervju för ' || COALESCE(v_job_title, 'en tjänst') || ' är bekräftad till ' || v_when;
      END IF;
    ELSIF NEW.status = 'declined' THEN
      v_title := 'Intervju nekad';
      IF v_actor_role = 'candidate' THEN
        v_body := v_candidate_name || ' kunde inte delta i intervjun för ' || COALESCE(v_job_title, 'en tjänst');
      ELSE
        v_body := 'Intervjun för ' || COALESCE(v_job_title, 'en tjänst') || ' kunde inte genomföras';
      END IF;
    ELSE
      v_title := NULL;
    END IF;

    IF v_title IS NOT NULL THEN
      v_meta := jsonb_build_object(
        'job_id', NEW.job_id,
        'interview_id', NEW.id,
        'route', CASE WHEN v_recipient = NEW.applicant_id THEN '/my-applications' ELSE '/employer' END
      );
      IF is_in_app_notification_enabled(v_recipient, 'interview_scheduled') THEN
        INSERT INTO notifications (user_id, type, title, body, metadata)
        VALUES (v_recipient, 'interview_scheduled', v_title, v_body, v_meta);
      END IF;
      IF is_notification_enabled(v_recipient, 'interview_scheduled') THEN
        PERFORM dispatch_interview_push(v_recipient, v_title, v_body, v_meta);
      END IF;
    END IF;
  END IF;

  IF v_time_changed AND NEW.status IN ('pending', 'confirmed') AND (NOT v_status_changed OR NEW.status = OLD.status) THEN
    v_title := 'Intervju ombokad';
    IF v_actor_role = 'employer' THEN
      v_recipient := NEW.applicant_id;
      v_body := 'Din intervju för ' || COALESCE(v_job_title, 'en tjänst') || ' har flyttats till ' || v_when;
    ELSE
      v_recipient := NEW.employer_id;
      v_body := v_candidate_name || ' föreslog ny tid för intervjun: ' || v_when;
    END IF;

    v_meta := jsonb_build_object(
      'job_id', NEW.job_id,
      'interview_id', NEW.id,
      'route', CASE WHEN v_recipient = NEW.applicant_id THEN '/my-applications' ELSE '/employer' END
    );
    IF is_in_app_notification_enabled(v_recipient, 'interview_scheduled') THEN
      INSERT INTO notifications (user_id, type, title, body, metadata)
      VALUES (v_recipient, 'interview_scheduled', v_title, v_body, v_meta);
    END IF;
    IF is_notification_enabled(v_recipient, 'interview_scheduled') THEN
      PERFORM dispatch_interview_push(v_recipient, v_title, v_body, v_meta);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;