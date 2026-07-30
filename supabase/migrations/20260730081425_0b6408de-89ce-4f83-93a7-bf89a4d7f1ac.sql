-- 1. Fix IDOR: employer dashboard stats overload had no auth guard
CREATE OR REPLACE FUNCTION public.get_employer_dashboard_stats(p_user_id uuid, p_active_job_ids uuid[])
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT jid
    FROM unnest(coalesce(p_active_job_ids, '{}'::uuid[])) AS jid
    WHERE auth.uid() IS NOT NULL
      AND auth.uid() = p_user_id
      AND public.can_view_job_application(jid)
  )
  SELECT json_build_object(
    'new_applications', (
      SELECT count(*)::int
      FROM job_applications
      WHERE job_id IN (SELECT jid FROM allowed)
        AND viewed_at IS NULL
    ),
    'saved_favorites', (
      SELECT count(*)::int
      FROM saved_jobs
      WHERE job_id IN (SELECT jid FROM allowed)
    ),
    'unread_messages', (
      SELECT count(*)::int
      FROM public.conversation_messages cm
      JOIN public.conversation_members me
        ON me.conversation_id = cm.conversation_id
       AND me.user_id = p_user_id
      WHERE auth.uid() = p_user_id
        AND cm.sender_id <> p_user_id
        AND (me.last_read_at IS NULL OR cm.created_at > me.last_read_at)
    )
  );
$$;

-- 2. Fix leak: plan details readable for any user id
CREATE OR REPLACE FUNCTION public.get_active_plan_details(_user_id uuid)
RETURNS TABLE(source_type text, tier plan_tier, status plan_status, expires_at timestamptz, max_active_jobs integer, max_users integer, plan_name text, price_sek integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH guard AS (
    SELECT (auth.uid() IS NOT NULL AND auth.uid() = _user_id) AS ok
  ),
  personal AS (
    SELECT 'subscription'::text AS source_type, us.tier, us.status, us.expires_at,
           sp.max_active_jobs, sp.max_users, sp.name AS plan_name, sp.price_sek
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.tier = us.tier
    WHERE (SELECT ok FROM guard)
      AND us.user_id = _user_id AND us.status = 'active'
      AND (us.expires_at IS NULL OR us.expires_at > now())
    ORDER BY sp.price_sek DESC LIMIT 1
  ),
  org_plan AS (
    SELECT 'org_subscription'::text, us.tier, us.status, us.expires_at,
           sp.max_active_jobs, sp.max_users, sp.name, sp.price_sek
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.tier = us.tier
    WHERE (SELECT ok FROM guard)
      AND us.status = 'active'
      AND (us.expires_at IS NULL OR us.expires_at > now())
      AND us.organization_id IS NOT NULL
      AND us.organization_id = public.get_user_organization_id(_user_id)
    ORDER BY sp.price_sek DESC LIMIT 1
  ),
  one_time AS (
    SELECT 'one_time'::text, 'one_time'::plan_tier, otp.status, otp.expires_at,
           1, 1, sp.name, otp.price_sek
    FROM public.one_time_purchases otp
    LEFT JOIN public.subscription_plans sp ON sp.tier = 'one_time'
    WHERE (SELECT ok FROM guard)
      AND otp.user_id = _user_id AND otp.status = 'active'
      AND (otp.activated_at IS NULL OR otp.expires_at IS NULL OR otp.expires_at > now())
    ORDER BY otp.purchased_at DESC LIMIT 1
  )
  SELECT * FROM personal
  UNION ALL
  SELECT * FROM org_plan WHERE NOT EXISTS (SELECT 1 FROM personal)
  UNION ALL
  SELECT * FROM one_time WHERE NOT EXISTS (SELECT 1 FROM personal) AND NOT EXISTS (SELECT 1 FROM org_plan);
$$;

-- 3. Lock destructive / internal-only functions to the system
REVOKE ALL ON FUNCTION public.run_data_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_data_retention() TO service_role;

REVOKE ALL ON FUNCTION public.trigger_inactive_account_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_inactive_account_retention() TO service_role;

REVOKE ALL ON FUNCTION public.purge_soft_deleted_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted_jobs() TO service_role;

REVOKE ALL ON FUNCTION public.increment_app_exception_count(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_app_exception_count(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.has_active_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_plan(uuid) TO service_role;

-- 4. Pure helper needs no elevated rights
ALTER FUNCTION public.try_uuid(text) SECURITY INVOKER;