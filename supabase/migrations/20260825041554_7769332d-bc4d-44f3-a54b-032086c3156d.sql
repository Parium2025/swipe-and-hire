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
      v_notified := true;
    END IF;
  END IF;

  -- Ombokning: skicka alltid en notis om tiden flyttats och ingen annan
  -- notis redan skickats. Tidigare tystades detta helt när statusen
  -- samtidigt återställdes till 'pending' vid ombokning.
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

-- Låt automationer för "intervju bokad" köras om vid ombokning.
CREATE OR REPLACE FUNCTION public.enqueue_outreach_dispatch_on_reschedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.outreach_dispatch_logs (
    owner_user_id, organization_id, automation_id, template_id, trigger, channel,
    recipient_user_id, interview_id, job_id, payload, status
  )
  SELECT
    oa.owner_user_id, oa.organization_id, oa.id, oa.template_id, oa.trigger, oa.channel,
    NEW.applicant_id, NEW.id, NEW.job_id,
    jsonb_build_object(
      'source_table', 'interviews', 'source_operation', 'RESCHEDULE', 'queued_at', now(),
      'delay_minutes', oa.delay_minutes, 'filters', oa.filters,
      'recipient_type', oa.recipient_type, 'job_id', NEW.job_id, 'interview_id', NEW.id,
      'revision', COALESCE(NEW.revision, 0)
    ),
    'pending'
  FROM public.outreach_automations oa
  JOIN public.outreach_templates ot ON ot.id = oa.template_id
  WHERE oa.owner_user_id = NEW.employer_id
    AND oa.trigger = 'interview_scheduled'
    AND oa.recipient_type = 'candidate'
    AND oa.is_enabled = true
    AND ot.is_active = true
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interview_reschedule_enqueue_outreach ON public.interviews;
CREATE TRIGGER trg_interview_reschedule_enqueue_outreach
AFTER UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.enqueue_outreach_dispatch_on_reschedule();