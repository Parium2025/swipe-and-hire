-- Säkerhetsnät: köar stängningsutskick för avslutade annonser (senaste 7 dygnen)
-- som av någon anledning saknar dem. Unik index uq_odl_job_closed_once hindrar dubbletter.
CREATE OR REPLACE FUNCTION public.enqueue_missed_job_closed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
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
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_missed_job_closed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_missed_job_closed() TO service_role;