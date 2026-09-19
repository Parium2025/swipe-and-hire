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
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notification_preferences preference
      WHERE preference.user_id = recipient.user_id
        AND preference.notification_type = 'application_decision_reminder'
        AND preference.in_app_enabled IS FALSE
    )
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
  ), summaries AS (
    SELECT
      claims.recipient_user_id,
      COUNT(*)::INTEGER AS candidate_count
    FROM claims
    GROUP BY claims.recipient_user_id
  ), created AS (
    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    SELECT
      summary.recipient_user_id,
      'application_decision_reminder',
      CASE
        WHEN summary.candidate_count = 1 THEN 'En kandidat väntar på beslut'
        ELSE summary.candidate_count || ' kandidater väntar på beslut'
      END,
      CASE
        WHEN summary.candidate_count = 1 THEN 'En kandidat har väntat i minst 14 dagar på besked.'
        ELSE summary.candidate_count || ' kandidater har väntat i minst 14 dagar på besked.'
      END,
      jsonb_build_object(
        'candidate_count', summary.candidate_count,
        'route', '/candidates'
      )
    FROM summaries summary
    RETURNING id
  )
  SELECT COUNT(*) INTO v_created FROM created;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_application_decision_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_application_decision_reminders() TO service_role;