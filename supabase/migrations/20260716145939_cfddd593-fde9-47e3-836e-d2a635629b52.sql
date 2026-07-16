-- Drop the overly broad policy that exposed every employer's full row
-- (including phone, org_number, address, postal_code, email) to any authenticated user.
DROP POLICY IF EXISTS "Authenticated users can view employer basic info" ON public.profiles;

-- Replacement: only fellow organization members can see each other's employer profile.
-- All other legitimate access paths remain intact via existing policies:
--   • "Users can view own profile"                       (self)
--   • "Employers can view applicant profiles for their jobs"
--   • "Conversation members can view each other profiles"
-- Owner-side reads of own sensitive fields go through get_my_profile() SECURITY DEFINER.
CREATE POLICY "Org members can view colleagues in same organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  role = 'employer'
  AND organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id(auth.uid())
);