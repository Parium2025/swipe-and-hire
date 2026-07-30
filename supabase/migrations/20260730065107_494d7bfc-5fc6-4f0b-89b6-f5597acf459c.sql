-- Endast systemet (edge functions) får köra dessa
REVOKE EXECUTE ON FUNCTION public.claim_admin_alert(text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_email_notification_enabled(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_notification_enabled(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_outreach_automation_for_event(uuid, outreach_trigger, outreach_channel) FROM authenticated;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='match_criterion_prompt'
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig); END LOOP;
END $$;

-- Egen data endast
CREATE OR REPLACE FUNCTION public.get_jobseeker_dashboard_stats(p_user_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN (SELECT json_build_object(
    'applications', (SELECT count(*)::int FROM job_applications WHERE applicant_id = p_user_id),
    'interviews', (SELECT count(*)::int FROM interviews WHERE applicant_id = p_user_id AND scheduled_at >= now() AND status IN ('pending','confirmed')),
    'saved_jobs', (SELECT count(*)::int FROM saved_jobs WHERE user_id = p_user_id),
    'unread_messages', (SELECT count(*)::int FROM public.conversation_messages cm
      JOIN public.conversation_members me ON me.conversation_id = cm.conversation_id AND me.user_id = p_user_id
      WHERE cm.sender_id <> p_user_id AND (me.last_read_at IS NULL OR cm.created_at > me.last_read_at))
  ));
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_distinct_candidates(p_job_ids uuid[])
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE j uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    FOREACH j IN ARRAY coalesce(p_job_ids, '{}'::uuid[]) LOOP
      IF NOT public.can_view_job_application(j) THEN RAISE EXCEPTION 'Access denied'; END IF;
    END LOOP;
  END IF;
  RETURN (SELECT COUNT(DISTINCT applicant_id)::int FROM public.job_applications WHERE job_id = ANY(p_job_ids));
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_distinct_my_candidates(p_recruiter_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_recruiter_id
     AND NOT public.same_organization(auth.uid(), p_recruiter_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN (SELECT COUNT(DISTINCT applicant_id)::int FROM public.my_candidates WHERE recruiter_id = p_recruiter_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.queue_cv_analysis(p_applicant_id uuid, p_cv_url text, p_application_id uuid DEFAULT NULL::uuid, p_job_id uuid DEFAULT NULL::uuid, p_priority integer DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_queue_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_applicant_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_application_id IS NOT NULL THEN
    SELECT id INTO v_queue_id FROM cv_analysis_queue
    WHERE application_id = p_application_id AND status IN ('pending','processing','completed') LIMIT 1;
    IF v_queue_id IS NOT NULL THEN RETURN v_queue_id; END IF;
  END IF;
  IF p_job_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM candidate_summaries WHERE applicant_id = p_applicant_id AND job_id = p_job_id) THEN
      RETURN NULL;
    END IF;
  END IF;
  INSERT INTO cv_analysis_queue (applicant_id, application_id, job_id, cv_url, priority)
  VALUES (p_applicant_id, p_application_id, p_job_id, p_cv_url, p_priority)
  RETURNING id INTO v_queue_id;
  RETURN v_queue_id;
END;
$function$;