DROP TRIGGER IF EXISTS trg_log_my_candidate_stage_change ON public.my_candidates;
DROP FUNCTION IF EXISTS public.log_my_candidate_stage_change();
DELETE FROM public.candidate_activities WHERE activity_type = 'stage_changed';