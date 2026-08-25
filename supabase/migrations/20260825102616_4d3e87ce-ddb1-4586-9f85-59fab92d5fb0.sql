-- 1. conversation_blocks: allow owner to release their own block
CREATE POLICY "Users can update their own blocks"
ON public.conversation_blocks
FOR UPDATE
TO authenticated
USING (auth.uid() = blocker_id)
WITH CHECK (auth.uid() = blocker_id);

-- 2. user_sessions: allow users to revoke their own sessions (revoked_at only)
GRANT UPDATE (revoked_at) ON public.user_sessions TO authenticated;

CREATE POLICY "Users can revoke their own sessions"
ON public.user_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. user_roles: remove self-referential loophole in INSERT policy
DROP POLICY IF EXISTS "Admins can insert to user_roles" ON public.user_roles;

CREATE POLICY "Admins can insert to user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND public.is_org_admin(auth.uid(), organization_id)
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.organization_id = user_roles.organization_id
    )
  )
);

-- 4. job_applications: stop broadcasting full PII rows in realtime DELETE payloads
ALTER TABLE public.job_applications REPLICA IDENTITY DEFAULT;