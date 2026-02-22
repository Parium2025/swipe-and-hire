CREATE OR REPLACE TRIGGER trg_log_candidate_added_to_my_candidates
  AFTER INSERT ON public.my_candidates
  FOR EACH ROW
  EXECUTE FUNCTION log_candidate_added_to_my_candidates();