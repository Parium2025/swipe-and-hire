REVOKE EXECUTE ON FUNCTION public.refresh_candidate_search_index(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.trigger_refresh_candidate_search_index() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.trigger_refresh_candidate_search_index_from_summary() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.trigger_refresh_candidate_search_index_from_profile_summary() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.trigger_refresh_candidate_search_index_from_notes() FROM PUBLIC, authenticated, anon;