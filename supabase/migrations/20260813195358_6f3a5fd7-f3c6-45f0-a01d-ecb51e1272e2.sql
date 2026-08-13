CREATE OR REPLACE FUNCTION public.log_interview_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb;
BEGIN
  v_meta := jsonb_build_object(
    'interview_id', NEW.id,
    'job_id', NEW.job_id,
    'application_id', NEW.application_id,
    'location_type', NEW.location_type,
    'location_details', NEW.location_details,
    'duration_minutes', NEW.duration_minutes
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.candidate_activities (applicant_id, user_id, activity_type, old_value, new_value, metadata)
    VALUES (NEW.applicant_id, NEW.employer_id, 'interview_scheduled', NULL, NEW.scheduled_at::text, v_meta);
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.candidate_activities (applicant_id, user_id, activity_type, old_value, new_value, metadata)
    VALUES (NEW.applicant_id, NEW.employer_id, 'interview_cancelled', OLD.scheduled_at::text, NULL, v_meta);
    RETURN NEW;
  END IF;

  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
     OR NEW.location_type IS DISTINCT FROM OLD.location_type
     OR NEW.location_details IS DISTINCT FROM OLD.location_details THEN
    INSERT INTO public.candidate_activities (applicant_id, user_id, activity_type, old_value, new_value, metadata)
    VALUES (NEW.applicant_id, NEW.employer_id, 'interview_rescheduled', OLD.scheduled_at::text, NEW.scheduled_at::text, v_meta);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_interview_activity_ins ON public.interviews;
CREATE TRIGGER trg_log_interview_activity_ins
AFTER INSERT ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.log_interview_activity();

DROP TRIGGER IF EXISTS trg_log_interview_activity_upd ON public.interviews;
CREATE TRIGGER trg_log_interview_activity_upd
AFTER UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.log_interview_activity();