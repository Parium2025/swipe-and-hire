-- Skickar "ny tid"-mejlet direkt när en intervjutid ändras, oavsett om
-- ändringen kommer från appen eller från arbetsgivarens kalender.
CREATE OR REPLACE FUNCTION public.notify_interview_reschedule_email()
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
  IF NEW.scheduled_at <= now() THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/interview-reminders',
      headers := public.cron_auth_header(),
      body := jsonb_build_object(
        'reschedule_interview_id', NEW.id::text,
        'old_scheduled_at', OLD.scheduled_at
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_interview_reschedule_email failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_interview_reschedule_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_interview_reschedule_email ON public.interviews;
CREATE TRIGGER trg_interview_reschedule_email
AFTER UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.notify_interview_reschedule_email();