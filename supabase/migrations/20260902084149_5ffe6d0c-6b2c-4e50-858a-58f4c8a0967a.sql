CREATE OR REPLACE FUNCTION public.has_active_plan(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR auth.uid() <> _user_id THEN false
    ELSE
      EXISTS (
        SELECT 1 FROM public.user_subscriptions
        WHERE user_id = _user_id AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
      ) OR EXISTS (
        SELECT 1 FROM public.user_subscriptions us
        WHERE us.status = 'active'
          AND (us.expires_at IS NULL OR us.expires_at > now())
          AND us.organization_id IS NOT NULL
          AND us.organization_id = public.get_user_organization_id(_user_id)
      ) OR EXISTS (
        SELECT 1 FROM public.one_time_purchases
        WHERE user_id = _user_id AND status = 'active'
          AND (activated_at IS NULL OR expires_at IS NULL OR expires_at > now())
      )
  END;
$function$;
REVOKE EXECUTE ON FUNCTION public.has_active_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_plan(uuid) TO authenticated, service_role;

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS auto_close_cursor uuid;

COMMENT ON COLUMN public.job_postings.auto_close_cursor IS
  'Internal keyset cursor for resumable candidate notifications when a job closes.';