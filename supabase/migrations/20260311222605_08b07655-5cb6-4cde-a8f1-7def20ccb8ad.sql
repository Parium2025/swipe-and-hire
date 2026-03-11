CREATE OR REPLACE FUNCTION public.get_employer_dashboard_stats(p_user_id uuid, p_active_job_ids uuid[])
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'new_applications', (
      SELECT count(*)::int
      FROM job_applications
      WHERE job_id = ANY(p_active_job_ids)
        AND viewed_at IS NULL
    ),
    'saved_favorites', (
      SELECT count(*)::int
      FROM saved_jobs
      WHERE job_id = ANY(p_active_job_ids)
    ),
    'unread_messages', (
      SELECT count(*)::int
      FROM public.conversation_messages cm
      JOIN public.conversation_members me
        ON me.conversation_id = cm.conversation_id
       AND me.user_id = p_user_id
      WHERE cm.sender_id <> p_user_id
        AND (me.last_read_at IS NULL OR cm.created_at > me.last_read_at)
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_jobseeker_dashboard_stats(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'applications', (
      SELECT count(*)::int
      FROM job_applications
      WHERE applicant_id = p_user_id
    ),
    'interviews', (
      SELECT count(*)::int
      FROM interviews
      WHERE applicant_id = p_user_id
        AND scheduled_at >= now()
        AND status IN ('pending', 'confirmed')
    ),
    'saved_jobs', (
      SELECT count(*)::int
      FROM saved_jobs
      WHERE user_id = p_user_id
    ),
    'unread_messages', (
      SELECT count(*)::int
      FROM public.conversation_messages cm
      JOIN public.conversation_members me
        ON me.conversation_id = cm.conversation_id
       AND me.user_id = p_user_id
      WHERE cm.sender_id <> p_user_id
        AND (me.last_read_at IS NULL OR cm.created_at > me.last_read_at)
    )
  );
$function$;