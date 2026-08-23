CREATE OR REPLACE FUNCTION public.get_employer_inbox_stats(p_user_id uuid, p_active_job_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH guard AS (
    SELECT (auth.uid() IS NOT NULL AND auth.uid() = p_user_id) AS ok
  ),
  allowed AS (
    -- Serverside sanning: användarens egna, aktiva (publicerade och ej utgångna) annonser.
    SELECT jp.id AS jid
    FROM public.job_postings jp
    WHERE (SELECT ok FROM guard)
      AND jp.employer_id = p_user_id
      AND jp.deleted_at IS NULL
      AND jp.is_active = true
      AND NOT (jp.published_at IS NOT NULL AND jp.expires_at IS NOT NULL AND jp.expires_at < now())
  )
  SELECT jsonb_build_object(
    'new_applications', (
      SELECT count(*)::int FROM public.job_applications ja
      WHERE ja.job_id IN (SELECT jid FROM allowed) AND ja.viewed_at IS NULL
    ),
    'saved_favorites', (
      SELECT count(*)::int FROM public.saved_jobs sj
      WHERE sj.job_id IN (SELECT jid FROM allowed)
    ),
    'unread_messages', (
      SELECT count(*)::int
      FROM public.conversation_messages cm
      JOIN public.conversation_members me
        ON me.conversation_id = cm.conversation_id
       AND me.user_id = p_user_id
      WHERE (SELECT ok FROM guard)
        AND cm.sender_id <> p_user_id
        AND (me.last_read_at IS NULL OR cm.created_at > me.last_read_at)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_employer_inbox_stats(uuid, uuid[]) TO authenticated;