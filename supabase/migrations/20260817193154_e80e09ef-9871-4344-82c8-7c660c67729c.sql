CREATE OR REPLACE FUNCTION public.notify_employer_new_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employer uuid;
  v_title text;
  v_enabled boolean;
BEGIN
  SELECT employer_id, title INTO v_employer, v_title
  FROM public.job_postings WHERE id = NEW.job_id;

  IF v_employer IS NULL OR v_employer = NEW.applicant_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(in_app_enabled, true) INTO v_enabled
  FROM public.notification_preferences
  WHERE user_id = v_employer AND notification_type = 'new_application';

  IF v_enabled IS FALSE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, metadata)
  VALUES (
    v_employer,
    'new_application',
    'Ny ansökan',
    COALESCE(NULLIF(TRIM(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,'')), ''), 'En kandidat')
      || ' sökte ' || COALESCE(v_title, 'din annons'),
    jsonb_build_object('application_id', NEW.id, 'job_id', NEW.job_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_employer_new_application ON public.job_applications;
CREATE TRIGGER trg_notify_employer_new_application
AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_employer_new_application();

CREATE OR REPLACE FUNCTION public.notify_conversation_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    IF COALESCE((
      SELECT in_app_enabled FROM public.notification_preferences
      WHERE user_id = r.user_id AND notification_type = 'new_message'
    ), true) THEN
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

DROP TRIGGER IF EXISTS trg_notify_conversation_new_message ON public.conversation_messages;
CREATE TRIGGER trg_notify_conversation_new_message
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_conversation_new_message();