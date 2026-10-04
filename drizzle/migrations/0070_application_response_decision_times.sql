ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

COMMENT ON COLUMN public.job_applications.first_response_at IS 'Första åtgärden från arbetsgivaren: stegflytt, bokat möte eller manuellt chattmeddelande.';
COMMENT ON COLUMN public.job_applications.decided_at IS 'När ansökan fick beslut: Anställd eller avslag.';

CREATE INDEX IF NOT EXISTS idx_job_applications_job_applied ON public.job_applications (job_id, applied_at);

-- Stegflytt / avslag / anställd
CREATE OR REPLACE FUNCTION public.track_application_response_times()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status = 'pending' AND NEW.first_response_at IS NULL THEN
    NEW.first_response_at := now();
  END IF;
  IF NEW.rejected_at IS NOT NULL AND OLD.rejected_at IS NULL AND NEW.first_response_at IS NULL THEN
    NEW.first_response_at := now();
  END IF;
  IF NEW.decided_at IS NULL AND (
       (NEW.status = 'hired' AND OLD.status IS DISTINCT FROM 'hired')
    OR (NEW.rejected_at IS NOT NULL AND OLD.rejected_at IS NULL)
  ) THEN
    NEW.decided_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_track_application_response_times ON public.job_applications;
CREATE TRIGGER trg_track_application_response_times
BEFORE UPDATE OF status, rejected_at ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.track_application_response_times();

-- Bokat möte
CREATE OR REPLACE FUNCTION public.mark_application_response_from_interview()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.job_applications
     SET first_response_at = now()
   WHERE job_id = NEW.job_id AND applicant_id = NEW.applicant_id AND first_response_at IS NULL;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_application_response_from_interview() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mark_application_response_from_interview ON public.interviews;
CREATE TRIGGER trg_mark_application_response_from_interview
AFTER INSERT ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.mark_application_response_from_interview();

-- Manuellt chattmeddelande från arbetsgivarsidan (automatiska utskick räknas inte)
CREATE OR REPLACE FUNCTION public.mark_application_response_from_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app_id uuid;
  v_applicant uuid;
  v_job uuid;
BEGIN
  IF COALESCE(NEW.is_system_message, false) THEN RETURN NEW; END IF;
  SELECT c.application_id INTO v_app_id FROM public.conversations c WHERE c.id = NEW.conversation_id;
  IF v_app_id IS NULL THEN RETURN NEW; END IF;
  SELECT ja.applicant_id, ja.job_id INTO v_applicant, v_job
    FROM public.job_applications ja WHERE ja.id = v_app_id AND ja.first_response_at IS NULL;
  IF v_applicant IS NULL OR v_applicant = NEW.sender_id THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.outreach_dispatch_logs l
     WHERE l.automation_id IS NOT NULL AND l.channel = 'chat'
       AND l.recipient_user_id = v_applicant
       AND (l.job_id = v_job OR l.job_id IS NULL)
       AND l.created_at >= NEW.created_at - interval '1 day'
       AND COALESCE(l.sent_at, now()) >= NEW.created_at - interval '2 minutes'
  ) THEN
    RETURN NEW;
  END IF;
  UPDATE public.job_applications SET first_response_at = NEW.created_at
   WHERE id = v_app_id AND first_response_at IS NULL;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_application_response_from_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mark_application_response_from_message ON public.conversation_messages;
CREATE TRIGGER trg_mark_application_response_from_message
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public.mark_application_response_from_message();

-- Backfill från tillförlitliga händelser
UPDATE public.job_applications ja SET first_response_at = s.t
FROM (
  SELECT ja2.id, min(e.t) AS t
  FROM public.job_applications ja2
  JOIN LATERAL (
    SELECT i.created_at::timestamptz AS t FROM public.interviews i
     WHERE i.job_id = ja2.job_id AND i.applicant_id = ja2.applicant_id
    UNION ALL
    SELECT ja2.rejected_at
    UNION ALL
    SELECT a.created_at FROM public.candidate_activities a
     WHERE a.applicant_id = ja2.applicant_id AND a.activity_type IN ('candidate_contacted','interview_scheduled','added_to_pipeline')
       AND a.created_at >= ja2.applied_at
       AND (a.metadata->>'job_id' IS NULL OR a.metadata->>'job_id' = ja2.job_id::text)
  ) e ON e.t IS NOT NULL AND e.t >= ja2.applied_at
  WHERE ja2.first_response_at IS NULL
  GROUP BY ja2.id
) s
WHERE ja.id = s.id;

UPDATE public.job_applications SET decided_at = rejected_at
 WHERE decided_at IS NULL AND rejected_at IS NOT NULL;

-- Utökad rapport-RPC
CREATE OR REPLACE FUNCTION public.get_employer_process_times(p_user_id uuid, p_days_back integer DEFAULT NULL)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
  v_since timestamptz;
  v_prev timestamptz;
  v_result json;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN '{}'::json;
  END IF;
  v_org_id := get_user_organization_id(p_user_id);
  v_since := CASE WHEN p_days_back IS NOT NULL THEN now() - (p_days_back || ' days')::interval ELSE '1970-01-01'::timestamptz END;
  v_prev := CASE WHEN p_days_back IS NOT NULL THEN now() - (2 * p_days_back || ' days')::interval ELSE NULL END;

  WITH org_members AS (
    SELECT ur.user_id FROM public.user_roles ur
     WHERE v_org_id IS NOT NULL AND ur.organization_id = v_org_id AND ur.is_active = true
    UNION SELECT p_user_id
  ),
  apps AS (
    SELECT ja.applied_at, ja.first_response_at, ja.decided_at
      FROM public.job_applications ja
      JOIN public.job_postings jp ON jp.id = ja.job_id AND jp.deleted_at IS NULL
     WHERE jp.employer_id IN (SELECT user_id FROM org_members)
       AND ja.applicant_id NOT IN (SELECT user_id FROM org_members)
       AND ja.applied_at IS NOT NULL
  ),
  agg AS (
    SELECT
      avg(extract(epoch from first_response_at - applied_at)) FILTER (WHERE applied_at >= v_since AND first_response_at >= applied_at) AS resp_cur,
      count(*) FILTER (WHERE applied_at >= v_since AND first_response_at >= applied_at) AS resp_cur_n,
      count(*) FILTER (WHERE applied_at >= v_since AND first_response_at IS NULL) AS resp_waiting,
      avg(extract(epoch from first_response_at - applied_at)) FILTER (WHERE v_prev IS NOT NULL AND applied_at >= v_prev AND applied_at < v_since AND first_response_at >= applied_at) AS resp_prev,
      avg(extract(epoch from decided_at - applied_at)) FILTER (WHERE applied_at >= v_since AND decided_at >= applied_at) AS dec_cur,
      count(*) FILTER (WHERE applied_at >= v_since AND decided_at >= applied_at) AS dec_cur_n,
      avg(extract(epoch from decided_at - applied_at)) FILTER (WHERE v_prev IS NOT NULL AND applied_at >= v_prev AND applied_at < v_since AND decided_at >= applied_at) AS dec_prev
    FROM apps
  )
  SELECT json_build_object(
    'response', json_build_object('avg_seconds', round(resp_cur)::bigint, 'sample', resp_cur_n, 'waiting', resp_waiting, 'prev_avg_seconds', round(resp_prev)::bigint),
    'decision', json_build_object('avg_seconds', round(dec_cur)::bigint, 'sample', dec_cur_n, 'prev_avg_seconds', round(dec_prev)::bigint)
  ) INTO v_result FROM agg;
  RETURN v_result;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_employer_process_times(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employer_process_times(uuid, integer) TO authenticated;