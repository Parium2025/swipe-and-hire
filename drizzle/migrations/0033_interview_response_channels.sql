CREATE OR REPLACE FUNCTION public.notify_interview_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_notified boolean := false;
  v_is_response boolean := false;
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

  IF v_actor IS NULL THEN
    BEGIN
      v_actor := NULLIF(current_setting('app.interview_actor_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_actor := NULL;
    END;
  END IF;

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

    v_is_response := (v_actor_role = 'candidate' AND NEW.status IN ('confirmed', 'declined'));

    IF v_title IS NOT NULL THEN
      v_meta := jsonb_build_object(
        'job_id', NEW.job_id,
        'interview_id', NEW.id,
        'route', CASE WHEN v_recipient = NEW.applicant_id THEN '/my-applications' ELSE '/employer' END
      );
      IF v_is_response THEN
        IF COALESCE(
          (SELECT in_app_enabled FROM notification_preferences
            WHERE user_id = v_recipient AND notification_type = 'interview_response'),
          false
        ) THEN
          INSERT INTO notifications (user_id, type, title, body, metadata)
          VALUES (v_recipient, 'interview_response', v_title, v_body, v_meta);
        END IF;
        IF COALESCE(
          (SELECT is_enabled FROM notification_preferences
            WHERE user_id = v_recipient AND notification_type = 'interview_response'),
          true
        ) THEN
          PERFORM dispatch_interview_push(v_recipient, v_title, v_body, v_meta);
        END IF;
      ELSE
        IF is_in_app_notification_enabled(v_recipient, 'interview_scheduled') THEN
          INSERT INTO notifications (user_id, type, title, body, metadata)
          VALUES (v_recipient, 'interview_scheduled', v_title, v_body, v_meta);
        END IF;
        IF is_notification_enabled(v_recipient, 'interview_scheduled') THEN
          PERFORM dispatch_interview_push(v_recipient, v_title, v_body, v_meta);
        END IF;
      END IF;
      v_notified := true;
    END IF;
  END IF;

  IF v_time_changed AND NEW.status IN ('pending', 'confirmed') AND NOT v_notified THEN
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

CREATE OR REPLACE FUNCTION public.post_interview_response_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_conversation_id uuid;
  v_job_title text;
  v_when text;
  v_content text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('confirmed', 'declined') THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;
  IF v_actor IS NULL THEN
    BEGIN
      v_actor := NULLIF(current_setting('app.interview_actor_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_actor := NULL;
    END;
  END IF;

  IF v_actor IS DISTINCT FROM NEW.applicant_id THEN
    RETURN NEW;
  END IF;

  IF NOT COALESCE(
    (SELECT in_app_enabled FROM notification_preferences
      WHERE user_id = NEW.employer_id AND notification_type = 'interview_response'),
    false
  ) THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_job_title FROM job_postings WHERE id = NEW.job_id;
  v_when := to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Stockholm', 'DD Mon YYYY HH24:MI');

  SELECT c.id INTO v_conversation_id
  FROM conversations c
  JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = NEW.employer_id
  WHERE c.kind = 'job'
    AND c.candidate_id = NEW.applicant_id
    AND (
      (NEW.application_id IS NOT NULL AND c.application_id = NEW.application_id)
      OR (NEW.application_id IS NULL AND c.job_id = NEW.job_id)
    )
  ORDER BY c.updated_at DESC
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (is_group, job_id, application_id, candidate_id, kind, created_by)
    VALUES (false, NEW.job_id, NEW.application_id, NEW.applicant_id, 'job', NEW.employer_id)
    RETURNING id INTO v_conversation_id;

    INSERT INTO conversation_members (conversation_id, user_id, is_admin)
    VALUES (v_conversation_id, NEW.employer_id, true), (v_conversation_id, NEW.applicant_id, false)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  v_content := CASE
    WHEN NEW.status = 'confirmed'
      THEN 'Jag har tackat ja till intervjun för ' || COALESCE(v_job_title, 'tjänsten') || ' den ' || v_when || '.'
    ELSE 'Jag kan tyvärr inte delta i intervjun för ' || COALESCE(v_job_title, 'tjänsten') || ' den ' || v_when || '.'
  END;

  IF EXISTS (
    SELECT 1 FROM conversation_messages
    WHERE conversation_id = v_conversation_id
      AND sender_id = NEW.applicant_id
      AND content = v_content
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO conversation_messages (conversation_id, sender_id, content)
  VALUES (v_conversation_id, NEW.applicant_id, v_content);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'post_interview_response_chat_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interview_response_chat_message ON public.interviews;
CREATE TRIGGER trg_interview_response_chat_message
AFTER UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.post_interview_response_chat_message();