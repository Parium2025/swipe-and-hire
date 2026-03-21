-- Fix outreach queueing so job closures enqueue one dispatch per applicant and interviews keep correct recipient context
CREATE OR REPLACE FUNCTION public.enqueue_outreach_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger public.outreach_trigger;
  v_owner_user_id uuid;
  v_organization_id uuid;
  v_job_id uuid;
  v_interview_id uuid;
  v_candidate_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'job_postings' THEN
    IF NOT ((COALESCE(OLD.is_active, false) = true AND COALESCE(NEW.is_active, false) = false) OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)) THEN
      RETURN NEW;
    END IF;

    v_trigger := 'job_closed';
    v_owner_user_id := NEW.employer_id;
    v_organization_id := public.get_user_organization_id(NEW.employer_id);
    v_job_id := NEW.id;

    INSERT INTO public.outreach_dispatch_logs (
      owner_user_id,
      organization_id,
      automation_id,
      template_id,
      trigger,
      channel,
      recipient_user_id,
      job_id,
      payload,
      status
    )
    SELECT
      oa.owner_user_id,
      oa.organization_id,
      oa.id,
      oa.template_id,
      oa.trigger,
      oa.channel,
      ja.applicant_id,
      NEW.id,
      jsonb_build_object(
        'source_table', TG_TABLE_NAME,
        'source_operation', TG_OP,
        'queued_at', now(),
        'delay_minutes', oa.delay_minutes,
        'filters', oa.filters,
        'recipient_type', oa.recipient_type,
        'job_title', NEW.title,
        'job_id', NEW.id
      ),
      'pending'
    FROM public.outreach_automations oa
    JOIN public.outreach_templates ot ON ot.id = oa.template_id
    JOIN (
      SELECT DISTINCT applicant_id
      FROM public.job_applications
      WHERE job_id = NEW.id
    ) ja ON true
    WHERE oa.owner_user_id = v_owner_user_id
      AND oa.trigger = v_trigger
      AND oa.recipient_type = 'candidate'
      AND oa.is_enabled = true
      AND ot.is_active = true;

    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'interviews' THEN
    IF TG_OP <> 'INSERT' THEN
      RETURN NEW;
    END IF;

    v_trigger := 'interview_scheduled';
    v_owner_user_id := NEW.employer_id;
    v_organization_id := public.get_user_organization_id(NEW.employer_id);
    v_job_id := NEW.job_id;
    v_candidate_user_id := NEW.applicant_id;
    v_interview_id := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.outreach_dispatch_logs (
    owner_user_id,
    organization_id,
    automation_id,
    template_id,
    trigger,
    channel,
    recipient_user_id,
    interview_id,
    job_id,
    payload,
    status
  )
  SELECT
    oa.owner_user_id,
    oa.organization_id,
    oa.id,
    oa.template_id,
    oa.trigger,
    oa.channel,
    v_candidate_user_id,
    v_interview_id,
    v_job_id,
    jsonb_build_object(
      'source_table', TG_TABLE_NAME,
      'source_operation', TG_OP,
      'queued_at', now(),
      'delay_minutes', oa.delay_minutes,
      'filters', oa.filters,
      'recipient_type', oa.recipient_type,
      'job_id', v_job_id,
      'interview_id', v_interview_id
    ),
    'pending'
  FROM public.outreach_automations oa
  JOIN public.outreach_templates ot ON ot.id = oa.template_id
  WHERE oa.owner_user_id = v_owner_user_id
    AND oa.trigger = v_trigger
    AND oa.recipient_type = 'candidate'
    AND oa.is_enabled = true
    AND ot.is_active = true;

  RETURN NEW;
END;
$$;