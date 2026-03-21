-- Queue professional outreach dispatch whenever a job is closed or an interview is scheduled.
CREATE OR REPLACE FUNCTION public.enqueue_outreach_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger outreach_trigger;
  v_owner_user_id uuid;
  v_organization_id uuid;
  v_job_id uuid;
  v_interview_id uuid;
  v_candidate_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'job_postings' THEN
    IF NOT ((OLD.is_active = true AND NEW.is_active = false) OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)) THEN
      RETURN NEW;
    END IF;

    v_trigger := 'job_closed';
    v_owner_user_id := NEW.employer_id;
    v_organization_id := public.get_user_organization_id(NEW.employer_id);
    v_job_id := NEW.id;
    v_candidate_id := NULL;
    v_interview_id := NULL;
  ELSIF TG_TABLE_NAME = 'interviews' THEN
    IF TG_OP <> 'INSERT' THEN
      RETURN NEW;
    END IF;

    v_trigger := 'interview_scheduled';
    v_owner_user_id := NEW.employer_id;
    v_organization_id := public.get_user_organization_id(NEW.employer_id);
    v_job_id := NEW.job_id;
    v_candidate_id := NEW.applicant_id;
    v_interview_id := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.outreach_dispatch_logs (
    owner_user_id,
    organization_id,
    trigger,
    channel,
    recipient_type,
    status,
    job_id,
    candidate_user_id,
    interview_id,
    metadata
  )
  SELECT
    v_owner_user_id,
    v_organization_id,
    oa.trigger,
    oa.channel,
    oa.recipient_type,
    'pending',
    v_job_id,
    v_candidate_id,
    v_interview_id,
    jsonb_build_object(
      'source_table', TG_TABLE_NAME,
      'source_operation', TG_OP,
      'queued_at', now()
    )
  FROM public.outreach_automations oa
  JOIN public.outreach_templates ot ON ot.id = oa.template_id
  WHERE oa.owner_user_id = v_owner_user_id
    AND oa.trigger = v_trigger
    AND oa.is_enabled = true
    AND ot.is_active = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_outreach_dispatch_on_job_closed ON public.job_postings;
CREATE TRIGGER enqueue_outreach_dispatch_on_job_closed
AFTER UPDATE ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_outreach_dispatch();

DROP TRIGGER IF EXISTS enqueue_outreach_dispatch_on_interview_created ON public.interviews;
CREATE TRIGGER enqueue_outreach_dispatch_on_interview_created
AFTER INSERT ON public.interviews
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_outreach_dispatch();