CREATE OR REPLACE FUNCTION public.can_use_outreach_template(p_owner_user_id uuid, p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_organization_id IS NULL THEN auth.uid() = p_owner_user_id
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = p_organization_id
        AND ur.is_active = true
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_use_outreach_template(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_outreach_template(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view outreach templates in their scope" ON public.outreach_templates;
CREATE POLICY "Users can view outreach templates in their scope"
ON public.outreach_templates
FOR SELECT
TO authenticated
USING (public.can_use_outreach_template(owner_user_id, organization_id));