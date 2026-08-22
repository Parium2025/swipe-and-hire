ALTER TABLE public.outreach_dispatch_logs
  ADD COLUMN IF NOT EXISTS locked_until timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_odl_queue_claim
  ON public.outreach_dispatch_logs (status, created_at)
  WHERE status IN ('pending','retrying');

-- Förhindra dubbletter för intervjuspåren (samma regel + intervju = en rad)
CREATE UNIQUE INDEX IF NOT EXISTS uq_odl_interview_once
  ON public.outreach_dispatch_logs (automation_id, interview_id, trigger)
  WHERE interview_id IS NOT NULL AND automation_id IS NOT NULL
    AND trigger IN ('interview_scheduled','interview_before','interview_after');

CREATE OR REPLACE FUNCTION public.claim_outreach_dispatch(
  p_owner_user_id uuid DEFAULT NULL,
  p_trigger public.outreach_trigger DEFAULT NULL,
  p_interview_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
)
RETURNS SETOF public.outreach_dispatch_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.outreach_dispatch_logs odl
  SET locked_until = now() + interval '5 minutes'
  WHERE odl.id IN (
    SELECT q.id
    FROM public.outreach_dispatch_logs q
    WHERE q.status IN ('pending','retrying')
      AND (q.locked_until IS NULL OR q.locked_until < now())
      AND (p_owner_user_id IS NULL OR q.owner_user_id = p_owner_user_id)
      AND (p_trigger IS NULL OR q.trigger = p_trigger)
      AND (p_interview_id IS NULL OR q.interview_id = p_interview_id)
      AND (
        CASE
          WHEN q.next_attempt_at IS NOT NULL THEN q.next_attempt_at <= now()
          WHEN q.trigger IN ('manual_send','interview_before','interview_after') THEN true
          ELSE q.created_at
               + (COALESCE(NULLIF(q.payload->>'delay_minutes',''),'0')::numeric * interval '1 minute')
               <= now()
        END
      )
    ORDER BY q.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 30), 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING odl.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_outreach_dispatch(uuid, public.outreach_trigger, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outreach_dispatch(uuid, public.outreach_trigger, uuid, integer) TO service_role;