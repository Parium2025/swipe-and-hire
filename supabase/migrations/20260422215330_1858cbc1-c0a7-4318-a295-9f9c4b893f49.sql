-- ============================================================
-- Push notifications for interviews (employer + candidate)
-- ============================================================
-- Adds:
--   1. FCM push (via send-push-notification edge function) on INSERT
--      — extends existing notify_interview_scheduled trigger
--   2. New UPDATE trigger for status changes (cancelled/confirmed/declined)
--      and reschedules (scheduled_at change), with both in-app + push
--
-- Uses pg_net for fire-and-forget HTTP calls. All branches respect
-- is_notification_enabled() for per-user opt-out.
-- ============================================================

-- ── Helper: fire push via send-push-notification edge function ──
CREATE OR REPLACE FUNCTION public.dispatch_interview_push(
  p_recipient_id uuid,
  p_title text,
  p_body text,
  p_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_anon text;
  v_has_token boolean;
BEGIN
  -- Skip if user has no active push tokens (avoid wasted edge invocations)
  SELECT EXISTS(
    SELECT 1 FROM device_push_tokens
    WHERE user_id = p_recipient_id AND is_active = true
  ) INTO v_has_token;

  IF NOT v_has_token THEN
    RETURN;
  END IF;

  v_url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/send-push-notification';
  v_anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyamFlZ2FwdXVqdXNoc2lvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjkzMjYsImV4cCI6MjA3OTE0NTMyNn0.mEr8DfMmx8kAX7YttCGEX9B4CZZcoo8l_rI0-EFFpQA';

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon
    ),
    body := jsonb_build_object(
      'recipient_id', p_recipient_id,
      'title', p_title,
      'body', p_body,
      'data', COALESCE(
        (SELECT jsonb_object_agg(key, value::text)
         FROM jsonb_each_text(p_metadata)),
        '{}'::jsonb
      )
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Never let push failures break the trigger
  RAISE WARNING 'dispatch_interview_push failed for %: %', p_recipient_id, SQLERRM;
END;
$$;

-- ── Extend INSERT trigger: also send push ──
CREATE OR REPLACE FUNCTION public.notify_interview_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Candidate
  IF is_notification_enabled(NEW.applicant_id, 'interview_scheduled') THEN
    v_body_candidate := 'Du har en intervju inbokad för ' || COALESCE(v_job_title, 'en tjänst') || ' den ' || v_when;
    v_meta_candidate := jsonb_build_object('job_id', NEW.job_id, 'interview_id', NEW.id, 'route', '/my-applications');

    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (NEW.applicant_id, 'interview_scheduled', 'Intervju inbokad', v_body_candidate, v_meta_candidate);

    PERFORM dispatch_interview_push(NEW.applicant_id, 'Intervju inbokad', v_body_candidate, v_meta_candidate);
  END IF;

  -- Employer
  IF is_notification_enabled(NEW.employer_id, 'interview_scheduled') THEN
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

    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (NEW.employer_id, 'interview_scheduled', 'Intervju bokad', v_body_employer, v_meta_employer);

    PERFORM dispatch_interview_push(NEW.employer_id, 'Intervju bokad', v_body_employer, v_meta_employer);
  END IF;

  RETURN NEW;
END;
$$;

-- ── New UPDATE trigger: status changes & reschedules ──
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
  v_actor_role text; -- 'employer' or 'candidate'
  v_title TEXT;
  v_body TEXT;
  v_meta jsonb;
BEGIN
  v_status_changed := (NEW.status IS DISTINCT FROM OLD.status);
  v_time_changed := (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at);

  IF NOT v_status_changed AND NOT v_time_changed THEN
    RETURN NEW;
  END IF;

  -- Determine actor (best-effort): if auth.uid() matches applicant => candidate acted
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

  -- ── Status change ──
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
      v_title := NULL; -- Unknown status: skip
    END IF;

    IF v_title IS NOT NULL AND is_notification_enabled(v_recipient, 'interview_scheduled') THEN
      v_meta := jsonb_build_object(
        'job_id', NEW.job_id,
        'interview_id', NEW.id,
        'route', CASE WHEN v_recipient = NEW.applicant_id THEN '/my-applications' ELSE '/employer' END
      );
      INSERT INTO notifications (user_id, type, title, body, metadata)
      VALUES (v_recipient, 'interview_scheduled', v_title, v_body, v_meta);
      PERFORM dispatch_interview_push(v_recipient, v_title, v_body, v_meta);
    END IF;
  END IF;

  -- ── Reschedule (time changed, still active) ──
  IF v_time_changed AND NEW.status IN ('pending', 'confirmed') AND (NOT v_status_changed OR NEW.status = OLD.status) THEN
    v_title := 'Intervju ombokad';
    IF v_actor_role = 'employer' THEN
      v_recipient := NEW.applicant_id;
      v_body := 'Din intervju för ' || COALESCE(v_job_title, 'en tjänst') || ' har flyttats till ' || v_when;
    ELSE
      v_recipient := NEW.employer_id;
      v_body := v_candidate_name || ' föreslog ny tid för intervjun: ' || v_when;
    END IF;

    IF is_notification_enabled(v_recipient, 'interview_scheduled') THEN
      v_meta := jsonb_build_object(
        'job_id', NEW.job_id,
        'interview_id', NEW.id,
        'route', CASE WHEN v_recipient = NEW.applicant_id THEN '/my-applications' ELSE '/employer' END
      );
      INSERT INTO notifications (user_id, type, title, body, metadata)
      VALUES (v_recipient, 'interview_scheduled', v_title, v_body, v_meta);
      PERFORM dispatch_interview_push(v_recipient, v_title, v_body, v_meta);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop & recreate UPDATE trigger (idempotent)
DROP TRIGGER IF EXISTS on_interview_changed_notify ON public.interviews;
CREATE TRIGGER on_interview_changed_notify
  AFTER UPDATE ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_interview_changed();