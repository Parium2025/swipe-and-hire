CREATE OR REPLACE FUNCTION public.enqueue_outreach_dispatch_on_interview_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('cancelled', 'declined') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Inga kvarvarande påminnelser för en intervju som inte blir av.
  DELETE FROM public.outreach_dispatch_logs
  WHERE interview_id = NEW.id
    AND status IN ('pending', 'retrying')
    AND trigger IN ('interview_scheduled', 'interview_before', 'interview_after');

  INSERT INTO public.outreach_dispatch_logs (
    owner_user_id, organization_id, automation_id, template_id, trigger, channel,
    recipient_user_id, interview_id, job_id, payload, status
  )
  SELECT
    oa.owner_user_id, oa.organization_id, oa.id, oa.template_id, oa.trigger, oa.channel,
    NEW.applicant_id, NEW.id, NEW.job_id,
    jsonb_build_object(
      'source_table', 'interviews', 'source_operation', 'CANCEL', 'queued_at', now(),
      'delay_minutes', oa.delay_minutes, 'filters', oa.filters,
      'recipient_type', oa.recipient_type, 'job_id', NEW.job_id, 'interview_id', NEW.id,
      'cancelled_status', NEW.status
    ),
    'pending'
  FROM public.outreach_automations oa
  JOIN public.outreach_templates ot ON ot.id = oa.template_id
  WHERE oa.owner_user_id = NEW.employer_id
    AND oa.trigger = 'interview_cancelled'
    AND oa.recipient_type = 'candidate'
    AND oa.is_enabled = true
    AND ot.is_active = true
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_outreach_dispatch_on_interview_cancelled() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_interview_cancelled_enqueue_outreach ON public.interviews;
CREATE TRIGGER trg_interview_cancelled_enqueue_outreach
AFTER UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.enqueue_outreach_dispatch_on_interview_cancelled();