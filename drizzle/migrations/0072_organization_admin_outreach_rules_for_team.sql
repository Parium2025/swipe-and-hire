CREATE OR REPLACE FUNCTION public.outreach_rule_owner(p_booker uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT admin_role.user_id
     FROM public.user_roles booker_role
     JOIN public.user_roles admin_role ON admin_role.organization_id = booker_role.organization_id
     WHERE booker_role.user_id = p_booker AND booker_role.is_active = true
       AND booker_role.organization_id IS NOT NULL
       AND admin_role.is_active = true AND admin_role.role = 'admin'
     ORDER BY admin_role.user_id LIMIT 1),
    p_booker
  )
$$;
REVOKE ALL ON FUNCTION public.outreach_rule_owner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_rule_owner(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_outreach_dispatch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_trigger public.outreach_trigger;
  v_owner_user_id uuid;
  v_organization_id uuid;
  v_job_id uuid;
  v_interview_id uuid;
  v_candidate_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'job_postings' THEN
    IF NOT ((COALESCE(OLD.is_active, false) = true AND COALESCE(NEW.is_active, false) = false) OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)) THEN RETURN NEW; END IF;
    v_trigger := 'job_closed';
    v_owner_user_id := NEW.employer_id;
    v_organization_id := public.get_user_organization_id(v_owner_user_id);
    v_job_id := NEW.id;

    INSERT INTO public.outreach_dispatch_logs (owner_user_id, organization_id, automation_id, template_id, trigger, channel, recipient_user_id, job_id, payload, status)
    SELECT v_owner_user_id, v_organization_id, oa.id, oa.template_id, oa.trigger, oa.channel,
      ja.applicant_id, NEW.id,
      jsonb_build_object('source_table', TG_TABLE_NAME, 'source_operation', TG_OP, 'queued_at', now(),
        'delay_minutes', oa.delay_minutes, 'filters', oa.filters, 'recipient_type', oa.recipient_type,
        'job_title', NEW.title, 'job_id', NEW.id, 'application_id', ja.id,
        'closed_reason', CASE WHEN NEW.deleted_at IS NOT NULL THEN 'removed' ELSE 'expired' END), 'pending'
    FROM public.outreach_automations oa
    JOIN public.outreach_templates ot ON ot.id = oa.template_id
    JOIN (
      SELECT DISTINCT ON (applicant_id) id, applicant_id FROM public.job_applications
      WHERE job_id = NEW.id AND applicant_id IS NOT NULL AND rejected_at IS NULL
        AND COALESCE(status, '') NOT IN ('hired', 'rejected')
        AND NOT EXISTS (
          SELECT 1 FROM public.interviews i WHERE i.job_id = NEW.id
            AND i.applicant_id = job_applications.applicant_id
            AND COALESCE(i.status, '') NOT IN ('cancelled', 'declined'))
      ORDER BY applicant_id, created_at DESC
    ) ja ON true
    WHERE oa.owner_user_id = public.outreach_rule_owner(v_owner_user_id)
      AND oa.trigger = v_trigger AND oa.recipient_type = 'candidate'
      AND oa.is_enabled = true AND ot.is_active = true
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'job_applications' THEN
    IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
    v_trigger := 'application_received';
    v_candidate_user_id := NEW.applicant_id;
    v_job_id := NEW.job_id;
    SELECT jp.employer_id INTO v_owner_user_id FROM public.job_postings jp WHERE jp.id = NEW.job_id;
    IF v_owner_user_id IS NULL THEN RETURN NEW; END IF;
    v_organization_id := public.get_user_organization_id(v_owner_user_id);
  ELSIF TG_TABLE_NAME = 'interviews' THEN
    IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
    v_trigger := 'interview_scheduled';
    v_owner_user_id := NEW.employer_id;
    v_organization_id := public.get_user_organization_id(v_owner_user_id);
    v_job_id := NEW.job_id;
    v_candidate_user_id := NEW.applicant_id;
    v_interview_id := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.outreach_dispatch_logs (owner_user_id, organization_id, automation_id, template_id, trigger, channel, recipient_user_id, interview_id, job_id, payload, status)
  SELECT v_owner_user_id, v_organization_id, oa.id, oa.template_id, oa.trigger, oa.channel,
    v_candidate_user_id, v_interview_id, v_job_id,
    jsonb_build_object('source_table', TG_TABLE_NAME, 'source_operation', TG_OP, 'queued_at', now(),
      'delay_minutes', oa.delay_minutes, 'filters', oa.filters, 'recipient_type', oa.recipient_type,
      'job_id', v_job_id, 'interview_id', v_interview_id,
      'application_id', CASE WHEN TG_TABLE_NAME = 'job_applications' THEN NEW.id ELSE NULL END), 'pending'
  FROM public.outreach_automations oa
  JOIN public.outreach_templates ot ON ot.id = oa.template_id
  WHERE oa.owner_user_id = public.outreach_rule_owner(v_owner_user_id)
    AND oa.trigger = v_trigger AND oa.recipient_type = 'candidate'
    AND oa.is_enabled = true AND ot.is_active = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enqueue_outreach_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_outreach_dispatch() TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_outreach_dispatch_on_reschedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at OR NEW.status NOT IN ('pending', 'confirmed') THEN RETURN NEW; END IF;
  INSERT INTO public.outreach_dispatch_logs (owner_user_id, organization_id, automation_id, template_id, trigger, channel, recipient_user_id, interview_id, job_id, payload, status)
  SELECT NEW.employer_id, public.get_user_organization_id(NEW.employer_id), oa.id, oa.template_id, oa.trigger, oa.channel,
    NEW.applicant_id, NEW.id, NEW.job_id,
    jsonb_build_object('source_table', 'interviews', 'source_operation', 'RESCHEDULE', 'queued_at', now(),
      'delay_minutes', oa.delay_minutes, 'filters', oa.filters, 'recipient_type', oa.recipient_type,
      'job_id', NEW.job_id, 'interview_id', NEW.id, 'revision', COALESCE(NEW.revision, 0)), 'pending'
  FROM public.outreach_automations oa JOIN public.outreach_templates ot ON ot.id = oa.template_id
  WHERE oa.owner_user_id = public.outreach_rule_owner(NEW.employer_id)
    AND oa.trigger = 'interview_scheduled' AND oa.recipient_type = 'candidate'
    AND oa.is_enabled = true AND ot.is_active = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_outreach_dispatch_on_reschedule() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_outreach_dispatch_on_interview_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('cancelled', 'declined') OR OLD.status = NEW.status THEN RETURN NEW; END IF;
  DELETE FROM public.outreach_dispatch_logs WHERE interview_id = NEW.id AND status IN ('pending', 'retrying')
    AND trigger IN ('interview_scheduled', 'interview_before', 'interview_after');
  IF NEW.status = 'declined' THEN RETURN NEW; END IF;
  INSERT INTO public.outreach_dispatch_logs (owner_user_id, organization_id, automation_id, template_id, trigger, channel, recipient_user_id, interview_id, job_id, payload, status)
  SELECT NEW.employer_id, public.get_user_organization_id(NEW.employer_id), oa.id, oa.template_id, oa.trigger, oa.channel,
    NEW.applicant_id, NEW.id, NEW.job_id,
    jsonb_build_object('source_table', 'interviews', 'source_operation', 'CANCEL', 'queued_at', now(),
      'delay_minutes', oa.delay_minutes, 'filters', oa.filters, 'recipient_type', oa.recipient_type,
      'job_id', NEW.job_id, 'interview_id', NEW.id, 'cancelled_status', NEW.status), 'pending'
  FROM public.outreach_automations oa JOIN public.outreach_templates ot ON ot.id = oa.template_id
  WHERE oa.owner_user_id = public.outreach_rule_owner(NEW.employer_id)
    AND oa.trigger = 'interview_cancelled' AND oa.recipient_type = 'candidate'
    AND oa.is_enabled = true AND ot.is_active = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_outreach_dispatch_on_interview_cancelled() FROM PUBLIC, anon, authenticated;