DROP INDEX IF EXISTS public.uq_odl_interview_once;
CREATE UNIQUE INDEX uq_odl_interview_once
ON public.outreach_dispatch_logs (
  automation_id,
  recipient_user_id,
  interview_id,
  trigger,
  (COALESCE(payload ->> 'revision', '0'))
)
WHERE interview_id IS NOT NULL;