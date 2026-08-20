GRANT DELETE ON public.outreach_dispatch_logs TO authenticated;
CREATE POLICY "Users can delete outreach logs in their scope"
ON public.outreach_dispatch_logs
FOR DELETE
TO authenticated
USING (public.can_manage_outreach_scope(owner_user_id, organization_id));