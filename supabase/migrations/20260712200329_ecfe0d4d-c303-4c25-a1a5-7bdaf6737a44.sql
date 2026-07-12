-- Fix 1: Remove the public-role SELECT policy on profiles that leaked employer
-- rows (including sensitive columns) to anonymous Realtime subscribers.
-- The existing "Authenticated users can view employer basic info" policy still
-- covers the legitimate use case for logged-in users.
DROP POLICY IF EXISTS "Anyone can view employer basic profile info" ON public.profiles;

-- Fix 2: Scope organizations SELECT to members of the organization only,
-- instead of every authenticated user being able to read every org row
-- (including subscription_plan and max_recruiters).
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;

CREATE POLICY "Members can view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (id = public.get_user_organization_id(auth.uid()));