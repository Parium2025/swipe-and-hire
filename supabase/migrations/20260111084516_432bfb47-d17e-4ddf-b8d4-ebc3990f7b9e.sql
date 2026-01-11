-- CRITICAL INDEXES FOR 10M+ USER SCALABILITY
-- These indexes are essential for sub-millisecond queries at scale

-- job_applications: Most queried table - needs composite indexes
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_id ON public.job_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_applicant ON public.job_applications(job_id, applicant_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applied_at ON public.job_applications(applied_at DESC);

-- job_postings: Employer lookup is critical
CREATE INDEX IF NOT EXISTS idx_job_postings_employer_id ON public.job_postings(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_employer_active ON public.job_postings(employer_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON public.job_postings(created_at DESC);

-- profiles: User lookup
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON public.profiles(organization_id) WHERE organization_id IS NOT NULL;

-- user_roles: Organization queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_active ON public.user_roles(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_org ON public.user_roles(user_id, organization_id) WHERE is_active = true;

-- my_candidates: Recruiter's candidate list
CREATE INDEX IF NOT EXISTS idx_my_candidates_applicant_id ON public.my_candidates(applicant_id);
CREATE INDEX IF NOT EXISTS idx_my_candidates_application ON public.my_candidates(application_id);
CREATE INDEX IF NOT EXISTS idx_my_candidates_job_id ON public.my_candidates(job_id) WHERE job_id IS NOT NULL;

-- candidate_activities: Activity log queries
CREATE INDEX IF NOT EXISTS idx_candidate_activities_applicant ON public.candidate_activities(applicant_id);
CREATE INDEX IF NOT EXISTS idx_candidate_activities_user ON public.candidate_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_activities_created ON public.candidate_activities(created_at DESC);

-- candidate_notes: Note lookups
CREATE INDEX IF NOT EXISTS idx_candidate_notes_applicant ON public.candidate_notes(applicant_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_employer ON public.candidate_notes(employer_id);