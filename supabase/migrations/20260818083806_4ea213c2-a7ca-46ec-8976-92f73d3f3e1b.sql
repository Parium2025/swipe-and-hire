DROP TRIGGER IF EXISTS trg_move_candidates_before_list_delete ON public.candidate_lists;
DROP FUNCTION IF EXISTS public.move_candidates_before_list_delete();