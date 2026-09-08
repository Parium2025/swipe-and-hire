-- Avslag som separat markering per ansökan: kandidaten ligger kvar i sitt
-- steg, men utgår från automatiska avslutningsutskick för annonsen.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Befintliga avslagna ansökningar får markeringen (samma beteende som förr).
UPDATE public.job_applications
SET rejected_at = COALESCE(rejected_at, updated_at, created_at, now())
WHERE status = 'rejected' AND rejected_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_applications_job_rejected_at
  ON public.job_applications (job_id)
  WHERE rejected_at IS NOT NULL;

-- Uppdaterad stängningsfunktion: uteslut även kandidater med avslagsmarkering.
CREATE OR REPLACE FUNCTION public.enqueue_outreach_dispatch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      owner_user_id, organization_id, automation_id, template_id, trigger, channel,
      recipient_user_id, job_id, payload, status
    )
    SELECT
      oa.owner_user_id, oa.organization_id, oa.id, oa.template_id, oa.trigger, oa.channel,
      ja.applicant_id, NEW.id,
      jsonb_build_object(
        'source_table', TG_TABLE_NAME, 'source_operation', TG_OP, 'queued_at', now(),
        'delay_minutes', oa.delay_minutes, 'filters', oa.filters,
        'recipient_type', oa.recipient_type, 'job_title', NEW.title, 'job_id', NEW.id
      ),
      'pending'
    FROM public.outreach_automations oa
    JOIN public.outreach_templates ot ON ot.id = oa.template_id
    JOIN (
      SELECT DISTINCT applicant_id
      FROM public.job_applications
      WHERE job_id = NEW.id
        AND applicant_id IS NOT NULL
        AND COALESCE(status, 'pending') NOT IN ('hired', 'rejected')
        AND rejected_at IS NULL
    ) ja ON true
    WHERE oa.owner_user_id = v_owner_user_id
      AND oa.trigger = v_trigger AND oa.recipient_type = 'candidate'
      AND oa.is_enabled = true AND ot.is_active = true
    ON CONFLICT DO NOTHING;

    RETURN NEW;

  ELSIF TG_TABLE_NAME = 'job_applications' THEN
    IF TG_OP <> 'INSERT' THEN
      RETURN NEW;
    END IF;

    v_trigger := 'application_received';
    v_candidate_user_id := NEW.applicant_id;
    v_job_id := NEW.job_id;

    SELECT jp.employer_id INTO v_owner_user_id
    FROM public.job_postings jp WHERE jp.id = NEW.job_id;

    IF v_owner_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_organization_id := public.get_user_organization_id(v_owner_user_id);

    INSERT INTO public.outreach_dispatch_logs (
      owner_user_id, organization_id, automation_id, template_id, trigger, channel,
      recipient_user_id, job_id, payload, status
    )
    SELECT
      oa.owner_user_id, oa.organization_id, oa.id, oa.template_id, oa.trigger, oa.channel,
      v_candidate_user_id, v_job_id,
      jsonb_build_object(
        'source_table', TG_TABLE_NAME, 'source_operation', TG_OP, 'queued_at', now(),
        'delay_minutes', oa.delay_minutes, 'filters', oa.filters,
        'recipient_type', oa.recipient_type,
        'job_title', (SELECT title FROM public.job_postings WHERE id = v_job_id),
        'job_id', v_job_id, 'application_id', NEW.id
      ),
      'pending'
    FROM public.outreach_automations oa
    JOIN public.outreach_templates ot ON ot.id = oa.template_id
    WHERE oa.owner_user_id = v_owner_user_id
      AND oa.trigger = v_trigger AND oa.recipient_type = 'candidate'
      AND oa.is_enabled = true AND ot.is_active = true
    ON CONFLICT DO NOTHING;

    RETURN NEW;

  ELSIF TG_TABLE_NAME = 'interviews' THEN
    IF TG_OP <> 'INSERT' THEN
      RETURN NEW;
    END IF;

    v_trigger := 'interview_scheduled';
    v_candidate_user_id := NEW.applicant_id;
    v_job_id := NEW.job_id;
    v_interview_id := NEW.id;
    v_owner_user_id := NEW.employer_id;
    v_organization_id := public.get_user_organization_id(v_owner_user_id);

    INSERT INTO public.outreach_dispatch_logs (
      owner_user_id, organization_id, automation_id, template_id, trigger, channel,
      recipient_user_id, job_id, interview_id, payload, status
    )
    SELECT
      oa.owner_user_id, oa.organization_id, oa.id, oa.template_id, oa.trigger, oa.channel,
      v_candidate_user_id, v_job_id, v_interview_id,
      jsonb_build_object(
        'source_table', TG_TABLE_NAME, 'source_operation', TG_OP, 'queued_at', now(),
        'delay_minutes', oa.delay_minutes, 'filters', oa.filters,
        'recipient_type', oa.recipient_type,
        'job_title', (SELECT title FROM public.job_postings WHERE id = v_job_id),
        'job_id', v_job_id, 'interview_id', v_interview_id,
        'location_type', NEW.location_type
      ),
      'pending'
    FROM public.outreach_automations oa
    JOIN public.outreach_templates ot ON ot.id = oa.template_id
    WHERE oa.owner_user_id = v_owner_user_id
      AND oa.trigger = v_trigger AND oa.recipient_type = 'candidate'
      AND oa.is_enabled = true AND ot.is_active = true
    ON CONFLICT DO NOTHING;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_outreach_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_outreach_dispatch() TO service_role;