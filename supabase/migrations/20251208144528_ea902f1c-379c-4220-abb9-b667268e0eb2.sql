-- Allow profile owners to revoke access permissions
CREATE POLICY "Profile owners can revoke permissions"
ON public.profile_view_permissions
FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);