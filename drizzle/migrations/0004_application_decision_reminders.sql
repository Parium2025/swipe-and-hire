CREATE TABLE public.application_decision_reminder_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL,
  reminder_sent_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, recipient_user_id)
);

GRANT SELECT, UPDATE ON public.application_decision_reminder_state TO authenticated;
GRANT ALL ON public.application_decision_reminder_state TO service_role;

ALTER TABLE public.application_decision_reminder_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can view decision reminder state"
ON public.application_decision_reminder_state
FOR SELECT TO authenticated
USING (auth.uid() = recipient_user_id);

CREATE POLICY "Recipients can update decision reminder state"
ON public.application_decision_reminder_state
FOR UPDATE TO authenticated
USING (auth.uid() = recipient_user_id)
WITH CHECK (auth.uid() = recipient_user_id);

CREATE INDEX idx_application_decision_reminder_due
ON public.application_decision_reminder_state (snoozed_until, reminder_sent_at)
WHERE reminder_sent_at IS NULL;

CREATE INDEX idx_job_applications_undecided_applied
ON public.job_applications (applied_at, id)
WHERE rejected_at IS NULL AND status NOT IN ('hired', 'rejected');

CREATE OR REPLACE FUNCTION public.create_application_decision_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created INTEGER := 0;
BEGIN
  WITH eligible AS (
    SELECT
      a.id AS application_id,
      a.job_id,
      a.applicant_id,
      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), 'Kandidaten') AS candidate_name,
      j.title AS job_title,
      j.employer_id,
      ur.organization_id
    FROM public.job_applications a
    JOIN public.job_postings j ON j.id = a.job_id
    LEFT JOIN public.user_roles ur
      ON ur.user_id = j.employer_id
     AND ur.is_active IS NOT FALSE
     AND ur.organization_id IS NOT NULL
    WHERE COALESCE(a.applied_at, a.created_at) <= now() - interval '14 days'
      AND a.rejected_at IS NULL
      AND COALESCE(a.status, 'pending') NOT IN ('hired', 'rejected')
  ), recipients AS (
    SELECT DISTINCT
      e.application_id,
      e.job_id,
      e.applicant_id,
      e.candidate_name,
      e.job_title,
      recipient.user_id AS recipient_user_id
    FROM eligible e
    CROSS JOIN LATERAL (
      SELECT e.employer_id AS user_id
      UNION
      SELECT teammate.user_id
      FROM public.user_roles teammate
      WHERE e.organization_id IS NOT NULL
        AND teammate.organization_id = e.organization_id
        AND teammate.is_active IS NOT FALSE
        AND teammate.role IN ('employer', 'recruiter', 'company_admin', 'admin')
    ) recipient
  ), inserted_claims AS (
    INSERT INTO public.application_decision_reminder_state (
      application_id,
      recipient_user_id,
      reminder_sent_at,
      snoozed_until
    )
    SELECT application_id, recipient_user_id, now(), NULL
    FROM recipients
    ON CONFLICT (application_id, recipient_user_id) DO NOTHING
    RETURNING id, application_id, recipient_user_id
  ), renewed_claims AS (
    UPDATE public.application_decision_reminder_state state
    SET reminder_sent_at = now(), updated_at = now()
    FROM recipients recipient
    WHERE state.application_id = recipient.application_id
      AND state.recipient_user_id = recipient.recipient_user_id
      AND state.reminder_sent_at IS NULL
      AND state.snoozed_until IS NOT NULL
      AND state.snoozed_until <= now()
    RETURNING state.id, state.application_id, state.recipient_user_id
  ), claims AS (
    SELECT * FROM inserted_claims
    UNION ALL
    SELECT * FROM renewed_claims
  ), created AS (
    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    SELECT
      recipient.recipient_user_id,
      'application_decision_reminder',
      'En kandidat väntar på beslut',
      recipient.candidate_name || ' har väntat i 14 dagar på besked om ' || recipient.job_title || '.',
      jsonb_build_object(
        'application_id', recipient.application_id,
        'job_id', recipient.job_id,
        'applicant_id', recipient.applicant_id,
        'reminder_state_id', claims.id
      )
    FROM claims
    JOIN recipients recipient
      ON recipient.application_id = claims.application_id
     AND recipient.recipient_user_id = claims.recipient_user_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_created FROM created;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_application_decision_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_application_decision_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.snooze_application_decision_reminder(
  _state_id UUID,
  _days INTEGER DEFAULT 3
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until TIMESTAMPTZ;
BEGIN
  IF _days NOT IN (1, 3, 7) THEN
    RAISE EXCEPTION 'Ogiltig påminnelseperiod';
  END IF;

  v_until := now() + make_interval(days => _days);

  UPDATE public.application_decision_reminder_state
  SET reminder_sent_at = NULL,
      snoozed_until = v_until,
      updated_at = now()
  WHERE id = _state_id
    AND recipient_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Påminnelsen hittades inte';
  END IF;

  RETURN v_until;
END;
$$;

REVOKE ALL ON FUNCTION public.snooze_application_decision_reminder(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snooze_application_decision_reminder(UUID, INTEGER) TO authenticated;

SELECT cron.schedule(
  'application-decision-reminders-daily',
  '0 6 * * *',
  $cron$SELECT public.create_application_decision_reminders();$cron$
);