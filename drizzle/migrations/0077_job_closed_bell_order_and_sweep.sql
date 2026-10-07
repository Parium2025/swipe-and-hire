-- Klockans "Annons avslutad" får annonsens faktiska sluttid, så att flera
-- annonser som stängs i samma körning hamnar i rätt ordning.
CREATE OR REPLACE FUNCTION public.notify_job_closed_to_applicants()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_applicant RECORD;
  v_ended_at timestamptz;
BEGIN
  IF (OLD.is_active = true AND NEW.is_active = false)
     OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN

    v_ended_at := LEAST(clock_timestamp(), COALESCE(NEW.deleted_at, NEW.expires_at, clock_timestamp()));

    FOR v_applicant IN
      SELECT DISTINCT applicant_id FROM job_applications WHERE job_id = NEW.id
    LOOP
      IF is_in_app_notification_enabled(v_applicant.applicant_id, 'job_closed')
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.user_id = v_applicant.applicant_id AND n.type = 'job_closed'
             AND n.metadata->>'job_id' = NEW.id::text
             AND n.created_at > clock_timestamp() - interval '1 hour')
      THEN
        INSERT INTO notifications (user_id, type, title, body, metadata, created_at)
        VALUES (
          v_applicant.applicant_id,
          'job_closed',
          'Annons avslutad',
          'Tjänsten "' || COALESCE(NEW.title, 'Okänd tjänst') || '" har avslutats.',
          jsonb_build_object('job_id', NEW.id, 'route', '/my-applications'),
          v_ended_at
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Säkerhetsnät även för klockan: saknade "Annons avslutad" (senaste 7 dygnen).
CREATE OR REPLACE FUNCTION public.enqueue_missed_job_closed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer; v_bell integer;
BEGIN
  INSERT INTO public.outreach_dispatch_logs (
    owner_user_id, organization_id, automation_id, template_id, trigger, channel,
    recipient_user_id, job_id, payload, status
  )
  SELECT oa.owner_user_id, oa.organization_id, oa.id, oa.template_id, oa.trigger, oa.channel,
    ja.applicant_id, j.id,
    jsonb_build_object('source_table','job_postings','source_operation','SWEEP','queued_at',now(),
      'delay_minutes',0,'filters',oa.filters,'recipient_type',oa.recipient_type,
      'job_title',j.title,'job_id',j.id),
    'pending'
  FROM public.job_postings j
  JOIN public.outreach_automations oa
    ON oa.owner_user_id = j.employer_id AND oa.trigger = 'job_closed'
   AND oa.recipient_type = 'candidate' AND oa.is_enabled = true
  JOIN public.outreach_templates ot ON ot.id = oa.template_id AND ot.is_active = true
  JOIN (SELECT DISTINCT job_id, applicant_id FROM public.job_applications
        WHERE applicant_id IS NOT NULL
          AND COALESCE(status,'pending') NOT IN ('hired','rejected')
          AND rejected_at IS NULL) ja ON ja.job_id = j.id
  WHERE (
      (j.deleted_at IS NOT NULL AND j.deleted_at > now() - interval '7 days')
      OR (j.is_active = false AND j.expires_at IS NOT NULL
          AND j.expires_at < now() AND j.expires_at > now() - interval '7 days')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.outreach_dispatch_logs l
      WHERE l.trigger = 'job_closed' AND l.automation_id = oa.id
        AND l.recipient_user_id = ja.applicant_id AND l.job_id = j.id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.notifications (user_id, type, title, body, metadata, created_at)
  SELECT ja.applicant_id, 'job_closed', 'Annons avslutad',
    'Tjänsten "' || COALESCE(j.title, 'Okänd tjänst') || '" har avslutats.',
    jsonb_build_object('job_id', j.id, 'route', '/my-applications'),
    LEAST(now(), COALESCE(j.deleted_at, j.expires_at, now()))
  FROM public.job_postings j
  JOIN (SELECT DISTINCT job_id, applicant_id FROM public.job_applications
        WHERE applicant_id IS NOT NULL) ja ON ja.job_id = j.id
  WHERE (
      (j.deleted_at IS NOT NULL AND j.deleted_at > now() - interval '7 days')
      OR (j.is_active = false AND j.expires_at IS NOT NULL
          AND j.expires_at < now() AND j.expires_at > now() - interval '7 days')
    )
    AND public.is_in_app_notification_enabled(ja.applicant_id, 'job_closed')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = ja.applicant_id AND n.type = 'job_closed'
        AND n.metadata->>'job_id' = j.id::text);
  GET DIAGNOSTICS v_bell = ROW_COUNT;

  RETURN v_count + v_bell;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_missed_job_closed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_missed_job_closed() TO service_role;