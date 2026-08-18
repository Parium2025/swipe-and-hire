CREATE POLICY "Organization members can view colleagues stage settings"
ON public.user_stage_settings
FOR SELECT
TO authenticated
USING (public.same_organization(auth.uid(), user_id));