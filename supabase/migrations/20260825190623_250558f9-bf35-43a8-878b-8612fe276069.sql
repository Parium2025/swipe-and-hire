CREATE INDEX IF NOT EXISTS idx_job_stage_settings_job_id ON public.job_stage_settings(job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job_id ON public.interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_job_id ON public.candidate_evaluations(job_id);
CREATE INDEX IF NOT EXISTS idx_criterion_results_criterion_id ON public.criterion_results(criterion_id);
CREATE INDEX IF NOT EXISTS idx_candidate_summaries_job_id ON public.candidate_summaries(job_id);
CREATE INDEX IF NOT EXISTS idx_criterion_feedback_job_id ON public.criterion_feedback(job_id);
CREATE INDEX IF NOT EXISTS idx_criteria_eval_items_run_id ON public.criteria_eval_items(run_id);
CREATE INDEX IF NOT EXISTS idx_user_stage_settings_list_id ON public.user_stage_settings(list_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON public.user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer_user_id ON public.profile_views(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_user_id ON public.profile_views(viewed_user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_message_reactions_message_id ON public.conversation_message_reactions(message_id);

ALTER TABLE public.outreach_templates DROP CONSTRAINT IF EXISTS outreach_templates_subject_len;
ALTER TABLE public.outreach_templates ADD CONSTRAINT outreach_templates_subject_len CHECK (subject IS NULL OR char_length(subject) <= 200) NOT VALID;