CREATE TABLE public.interview_email_tokens (
  token uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '60 days',
  used_at timestamptz,
  used_answer text
);

CREATE INDEX idx_interview_email_tokens_interview ON public.interview_email_tokens(interview_id);

GRANT ALL ON public.interview_email_tokens TO service_role;

ALTER TABLE public.interview_email_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.respond_to_interview_by_token(p_token uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.interview_email_tokens%ROWTYPE;
  v_interview public.interviews%ROWTYPE;
  v_job_title text;
  v_new_status text;
BEGIN
  SELECT * INTO v_row FROM public.interview_email_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT * INTO v_interview FROM public.interviews WHERE id = v_row.interview_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  SELECT title INTO v_job_title FROM public.job_postings WHERE id = v_interview.job_id;

  IF v_interview.status IN ('cancelled', 'completed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed', 'status', v_interview.status, 'job_title', v_job_title);
  END IF;

  v_new_status := CASE WHEN p_accept THEN 'confirmed' ELSE 'declined' END;

  IF v_interview.status = v_new_status THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', v_new_status, 'job_title', v_job_title, 'scheduled_at', v_interview.scheduled_at);
  END IF;

  -- Notisfunktionen läser detta för att veta att kandidaten svarade,
  -- eftersom auth.uid() saknas när svaret kommer via mejllänken.
  PERFORM set_config('app.interview_actor_id', v_row.applicant_id::text, true);

  UPDATE public.interviews
  SET status = v_new_status
  WHERE id = v_row.interview_id;

  UPDATE public.interview_email_tokens
  SET used_at = now(), used_answer = v_new_status
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true, 'already', false, 'status', v_new_status, 'job_title', v_job_title, 'scheduled_at', v_interview.scheduled_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_interview_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

  -- Svar via mejllänken har ingen inloggad användare; då sätts kandidatens
  -- id här så att arbetsgivaren får notisen i stället för kandidaten.
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
$function$;