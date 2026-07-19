DROP POLICY "Permissions created via job application" ON public.profile_view_permissions;
CREATE POLICY "Permissions created via job application"
ON public.profile_view_permissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = viewer_id
  AND public.has_applied_to_employer(profile_id, viewer_id)
);