CREATE OR REPLACE FUNCTION public.increment_saved_search_matches(p_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.saved_searches
     SET new_matches_count = COALESCE(new_matches_count, 0) + 1,
         updated_at = now()
   WHERE id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION public.increment_saved_search_matches(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_saved_search_matches(uuid[]) TO service_role;