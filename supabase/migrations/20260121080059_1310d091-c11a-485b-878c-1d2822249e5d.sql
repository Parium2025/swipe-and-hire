-- Add DELETE policy for user_roles so admins can remove team members
CREATE POLICY "Admins can delete user_roles in their org"
ON public.user_roles
FOR DELETE
USING (
  is_org_admin(auth.uid()) 
  AND organization_id = get_user_organization_id(auth.uid())
  AND user_id != auth.uid()  -- Prevent admins from deleting their own role
);