ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_interview_reschedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
     OR NEW.location_type IS DISTINCT FROM OLD.location_type
     OR NEW.location_details IS DISTINCT FROM OLD.location_details THEN
    NEW.revision := COALESCE(OLD.revision, 0) + 1;
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
      NEW.reminder_sent_at := NULL;
      NEW.followup_reminder_sent_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interview_reschedule ON public.interviews;
CREATE TRIGGER trg_interview_reschedule
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_interview_reschedule();

CREATE OR REPLACE FUNCTION public.clear_pending_interview_dispatches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    DELETE FROM public.outreach_dispatch_logs
    WHERE interview_id = NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interview_reschedule_clear_dispatches ON public.interviews;
CREATE TRIGGER trg_interview_reschedule_clear_dispatches
  AFTER UPDATE ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_pending_interview_dispatches();