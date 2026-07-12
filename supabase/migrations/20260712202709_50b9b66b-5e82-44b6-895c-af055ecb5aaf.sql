
CREATE OR REPLACE FUNCTION public.guard_conversation_members_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change conversation_id or user_id';
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = OLD.conversation_id AND user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Only conversation admins can change admin status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_conversation_members_update ON public.conversation_members;
CREATE TRIGGER guard_conversation_members_update
  BEFORE UPDATE ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_conversation_members_update();

CREATE OR REPLACE FUNCTION public.guard_interviews_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN RETURN NEW; END IF;
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
DROP TRIGGER IF EXISTS guard_interviews_update ON public.interviews;
CREATE TRIGGER guard_interviews_update
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_interviews_update();

CREATE OR REPLACE FUNCTION public.guard_job_applications_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF public.can_view_job_application(OLD.job_id) THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.applicant_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.viewed_at IS DISTINCT FROM OLD.viewed_at
       OR NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.applicant_id IS DISTINCT FROM OLD.applicant_id
       OR NEW.applied_at IS DISTINCT FROM OLD.applied_at THEN
      RAISE EXCEPTION 'Applicants cannot modify status/viewed_at/job_id/applied_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_job_applications_update ON public.job_applications;
CREATE TRIGGER guard_job_applications_update
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_applications_update();
