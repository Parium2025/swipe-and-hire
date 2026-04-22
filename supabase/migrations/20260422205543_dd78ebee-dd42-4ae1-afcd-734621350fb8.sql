
-- 🚀 SCALABILITY INDEXES: Hot paths för 100k+ användare
-- Alla index använder IF NOT EXISTS så migrationen är idempotent

-- 1. JOB POSTINGS: Arbetsgivarens dashboard (aktiva/utgångna/drafts)
-- Query: WHERE employer_id = X AND deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_job_postings_employer_active_created
  ON public.job_postings (employer_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Publika swipe-flödet: WHERE is_active = true AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_job_postings_active_public
  ON public.job_postings (created_at DESC)
  WHERE is_active = true AND deleted_at IS NULL;

-- 2. INTERVIEWS: Kommande intervjuer per arbetsgivare
-- Query: WHERE employer_id = X AND scheduled_at >= NOW() AND status IN (...)
CREATE INDEX IF NOT EXISTS idx_interviews_employer_scheduled
  ON public.interviews (employer_id, scheduled_at)
  WHERE status IN ('pending', 'confirmed');

-- Kandidatens vy: WHERE applicant_id = X
CREATE INDEX IF NOT EXISTS idx_interviews_applicant_scheduled
  ON public.interviews (applicant_id, scheduled_at DESC);

-- 3. MY CANDIDATES: Recruiterns kandidatlista
-- Query: WHERE recruiter_id = X ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_my_candidates_recruiter_updated
  ON public.my_candidates (recruiter_id, updated_at DESC);

-- Lookup per applicant (för dedup och navigation)
CREATE INDEX IF NOT EXISTS idx_my_candidates_applicant
  ON public.my_candidates (applicant_id);

-- 4. CONVERSATION MEMBERS: Meddelandelistan
-- Query: WHERE user_id = X
CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON public.conversation_members (user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON public.conversation_members (conversation_id);

-- 5. CONVERSATIONS: Sortering på senaste meddelande
-- Query: WHERE id IN (...) ORDER BY last_message_at DESC
CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON public.conversations (last_message_at DESC NULLS LAST);

-- 6. CONVERSATION MESSAGES: Hämta meddelanden i en konversation
-- Query: WHERE conversation_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created
  ON public.conversation_messages (conversation_id, created_at DESC);

-- 7. JOB APPLICATIONS: Ansökningar per jobb (arbetsgivarvy)
-- Query: WHERE job_id = X ORDER BY applied_at DESC
CREATE INDEX IF NOT EXISTS idx_job_applications_job_applied
  ON public.job_applications (job_id, applied_at DESC);

-- Användarens egna ansökningar
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_applied
  ON public.job_applications (applicant_id, applied_at DESC);

-- 8. NOTIFICATIONS: Olästa notiser per användare
-- Query: WHERE user_id = X AND is_read = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_all
  ON public.notifications (user_id, created_at DESC);

-- 9. JOB VIEWS: Statistik per jobb
CREATE INDEX IF NOT EXISTS idx_job_views_job_viewed
  ON public.job_views (job_id, viewed_at DESC);

-- 10. CANDIDATE EVALUATIONS: Per jobb
CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_job_applicant
  ON public.candidate_evaluations (job_id, applicant_id);

-- 11. PROFILES: Organisations-lookups (RLS-policies använder detta)
CREATE INDEX IF NOT EXISTS idx_profiles_organization
  ON public.profiles (organization_id)
  WHERE organization_id IS NOT NULL;

-- 12. DEVICE PUSH TOKENS: Aktiva tokens per användare
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_active
  ON public.device_push_tokens (user_id)
  WHERE is_active = true;
