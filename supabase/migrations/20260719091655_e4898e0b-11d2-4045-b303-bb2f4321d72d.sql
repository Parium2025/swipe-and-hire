-- 1. conversation_members
DROP POLICY IF EXISTS "Members can update their own membership" ON public.conversation_members;
CREATE POLICY "Members can update their own membership"
ON public.conversation_members
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    is_admin = (SELECT cm.is_admin FROM public.conversation_members cm WHERE cm.id = conversation_members.id)
    OR public.is_conversation_admin(conversation_id)
  )
);

-- 2. conversation_messages
DROP POLICY IF EXISTS "Senders can update their messages" ON public.conversation_messages;
CREATE POLICY "Senders can update their messages"
ON public.conversation_messages
FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (
  auth.uid() = sender_id
  AND conversation_id = (SELECT cm.conversation_id FROM public.conversation_messages cm WHERE cm.id = conversation_messages.id)
  AND sender_id     = (SELECT cm.sender_id     FROM public.conversation_messages cm WHERE cm.id = conversation_messages.id)
  AND created_at    = (SELECT cm.created_at    FROM public.conversation_messages cm WHERE cm.id = conversation_messages.id)
);

-- 3. interviews
DROP POLICY IF EXISTS "Candidates can respond to interviews" ON public.interviews;
CREATE POLICY "Candidates can respond to interviews"
ON public.interviews
FOR UPDATE
USING (auth.uid() = applicant_id)
WITH CHECK (
  auth.uid() = applicant_id
  AND employer_id       = (SELECT i.employer_id       FROM public.interviews i WHERE i.id = interviews.id)
  AND applicant_id      = (SELECT i.applicant_id      FROM public.interviews i WHERE i.id = interviews.id)
  AND job_id            IS NOT DISTINCT FROM (SELECT i.job_id            FROM public.interviews i WHERE i.id = interviews.id)
  AND application_id    IS NOT DISTINCT FROM (SELECT i.application_id    FROM public.interviews i WHERE i.id = interviews.id)
  AND scheduled_at      IS NOT DISTINCT FROM (SELECT i.scheduled_at      FROM public.interviews i WHERE i.id = interviews.id)
  AND location_details  IS NOT DISTINCT FROM (SELECT i.location_details  FROM public.interviews i WHERE i.id = interviews.id)
  AND message           IS NOT DISTINCT FROM (SELECT i.message           FROM public.interviews i WHERE i.id = interviews.id)
);

-- 4. job_applications
DROP POLICY IF EXISTS "Users can update their own applications" ON public.job_applications;
CREATE POLICY "Users can update their own applications"
ON public.job_applications
FOR UPDATE
USING (auth.uid() = applicant_id)
WITH CHECK (
  auth.uid() = applicant_id
  AND applicant_id        = (SELECT ja.applicant_id        FROM public.job_applications ja WHERE ja.id = job_applications.id)
  AND job_id              = (SELECT ja.job_id              FROM public.job_applications ja WHERE ja.id = job_applications.id)
  AND status              IS NOT DISTINCT FROM (SELECT ja.status              FROM public.job_applications ja WHERE ja.id = job_applications.id)
  AND viewed_at           IS NOT DISTINCT FROM (SELECT ja.viewed_at           FROM public.job_applications ja WHERE ja.id = job_applications.id)
  AND questions_snapshot  IS NOT DISTINCT FROM (SELECT ja.questions_snapshot  FROM public.job_applications ja WHERE ja.id = job_applications.id)
);