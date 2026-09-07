CREATE OR REPLACE FUNCTION public.enqueue_outreach_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  automation_row RECORD;
  recipient_user_id UUID;
  resolved_job_id UUID;
  resolved_interview_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'job_postings' THEN
    IF OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status IN ('closed', 'expired', 'archived') THEN
      FOR automation_row IN
        SELECT *
        FROM public.outreach_automations
        WHERE owner_user_id = NEW.employer_id
          AND trigger = 'job_closed'
          AND is_enabled = true
      LOOP
        INSERT INTO public.outreach_dispatch_logs (
          owner_user_id, automation_id, template_id, channel, trigger,
          recipient_user_id, job_id, payload, status
        )
        SELECT
          NEW.employer_id,
          automation_row.id,
          automation_row.template_id,
          automation_row.channel,
          'job_closed'::public.outreach_trigger,
          applications.applicant_id,
          NEW.id,
          jsonb_build_object('delay_minutes', automation_row.delay_minutes),
          'pending'
        FROM public.job_applications applications
        WHERE applications.job_id = NEW.id
          AND applications.applicant_id IS NOT NULL
          AND COALESCE(applications.status, '') NOT IN ('hired', 'rejected')
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'job_applications' THEN
    recipient_user_id := NEW.applicant_id;
    resolved_job_id := NEW.job_id;
    resolved_interview_id := NULL;

    FOR automation_row IN
      SELECT *
      FROM public.outreach_automations
      WHERE owner_user_id = (
        SELECT employer_id FROM public.job_postings WHERE id = NEW.job_id
      )
        AND trigger = 'application_received'
        AND is_enabled = true
    LOOP
      INSERT INTO public.outreach_dispatch_logs (
        owner_user_id, automation_id, template_id, channel, trigger,
        recipient_user_id, job_id, interview_id, payload, status
      ) VALUES (
        automation_row.owner_user_id,
        automation_row.id,
        automation_row.template_id,
        automation_row.channel,
        automation_row.trigger,
        recipient_user_id,
        resolved_job_id,
        resolved_interview_id,
        jsonb_build_object('delay_minutes', automation_row.delay_minutes),
        'pending'
      ) ON CONFLICT DO NOTHING;
    END LOOP;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'interviews' THEN
    recipient_user_id := NEW.applicant_id;
    resolved_job_id := NEW.job_id;
    resolved_interview_id := NEW.id;

    FOR automation_row IN
      SELECT *
      FROM public.outreach_automations
      WHERE owner_user_id = NEW.employer_id
        AND trigger = 'interview_scheduled'
        AND is_enabled = true
    LOOP
      INSERT INTO public.outreach_dispatch_logs (
        owner_user_id, automation_id, template_id, channel, trigger,
        recipient_user_id, job_id, interview_id, payload, status
      ) VALUES (
        automation_row.owner_user_id,
        automation_row.id,
        automation_row.template_id,
        automation_row.channel,
        automation_row.trigger,
        recipient_user_id,
        resolved_job_id,
        resolved_interview_id,
        jsonb_build_object(
          'delay_minutes', automation_row.delay_minutes,
          'location_type', NEW.location_type
        ),
        'pending'
      ) ON CONFLICT DO NOTHING;
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_outreach_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_outreach_dispatch() TO service_role;