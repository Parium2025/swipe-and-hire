CREATE UNIQUE INDEX IF NOT EXISTS uq_odl_interview_once
ON public.outreach_dispatch_logs (automation_id, recipient_user_id, interview_id, trigger)
WHERE interview_id IS NOT NULL;