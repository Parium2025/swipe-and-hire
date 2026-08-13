
-- 1. Robust service-role detection + full field coverage
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role'),
    ''
  ) = 'service_role' OR auth.uid() IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.guard_job_applications_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_service_role() THEN RETURN NEW; END IF;
  IF public.can_view_job_application(OLD.job_id) THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.applicant_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.viewed_at IS DISTINCT FROM OLD.viewed_at
       OR NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.applicant_id IS DISTINCT FROM OLD.applicant_id
       OR NEW.applied_at IS DISTINCT FROM OLD.applied_at
       OR NEW.questions_snapshot IS DISTINCT FROM OLD.questions_snapshot THEN
      RAISE EXCEPTION 'Applicants cannot modify status, viewed_at, job_id, applied_at or questions_snapshot';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_interviews_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_service_role() THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.employer_id THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.applicant_id THEN
    IF NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.applicant_id IS DISTINCT FROM OLD.applicant_id
       OR NEW.application_id IS DISTINCT FROM OLD.application_id
       OR NEW.employer_id IS DISTINCT FROM OLD.employer_id
       OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
       OR NEW.location_type IS DISTINCT FROM OLD.location_type
       OR NEW.location_details IS DISTINCT FROM OLD.location_details
       OR NEW.subject IS DISTINCT FROM OLD.subject
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.followup_reminder_sent_at IS DISTINCT FROM OLD.followup_reminder_sent_at THEN
      RAISE EXCEPTION 'Candidates can only respond to an interview (status)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_conversation_messages_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_service_role() THEN RETURN NEW; END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.attachment_url IS DISTINCT FROM OLD.attachment_url
     OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name
     OR NEW.attachment_type IS DISTINCT FROM OLD.attachment_type THEN
    RAISE EXCEPTION 'Only message content can be edited';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach the triggers (previously the functions existed but were never bound)
DROP TRIGGER IF EXISTS guard_job_applications_update_trg ON public.job_applications;
CREATE TRIGGER guard_job_applications_update_trg
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_applications_update();

DROP TRIGGER IF EXISTS guard_interviews_update_trg ON public.interviews;
CREATE TRIGGER guard_interviews_update_trg
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_interviews_update();

DROP TRIGGER IF EXISTS guard_conversation_messages_update_trg ON public.conversation_messages;
CREATE TRIGGER guard_conversation_messages_update_trg
  BEFORE UPDATE ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_conversation_messages_update();

DROP TRIGGER IF EXISTS guard_conversation_members_update_trg ON public.conversation_members;
CREATE TRIGGER guard_conversation_members_update_trg
  BEFORE UPDATE ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_conversation_members_update();

-- 3. Replace the tautological WITH CHECK clauses with simple ownership checks
DROP POLICY IF EXISTS "Users can update their own applications" ON public.job_applications;
CREATE POLICY "Users can update their own applications"
  ON public.job_applications FOR UPDATE TO authenticated
  USING (auth.uid() = applicant_id)
  WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Candidates can respond to interviews" ON public.interviews;
CREATE POLICY "Candidates can respond to interviews"
  ON public.interviews FOR UPDATE TO authenticated
  USING (auth.uid() = applicant_id)
  WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Senders can update their messages" ON public.conversation_messages;
CREATE POLICY "Senders can update their messages"
  ON public.conversation_messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);
