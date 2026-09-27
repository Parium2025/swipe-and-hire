-- Endast ägaren eller en org-admin får skapa/ändra/ta bort utskicksmallar och automationer.
-- Rekryterare behåller läsåtkomst (SELECT-policierna är orörda).

DROP POLICY "Users can insert outreach templates in their scope" ON public.outreach_templates;
DROP POLICY "Users can update outreach templates in their scope" ON public.outreach_templates;
DROP POLICY "Users can delete outreach templates in their scope" ON public.outreach_templates;

CREATE POLICY "Owners and org admins can insert outreach templates"
ON public.outreach_templates FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
);

CREATE POLICY "Owners and org admins can update outreach templates"
ON public.outreach_templates FOR UPDATE TO authenticated
USING (
  owner_user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
)
WITH CHECK (
  owner_user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
);

CREATE POLICY "Owners and org admins can delete outreach templates"
ON public.outreach_templates FOR DELETE TO authenticated
USING (
  owner_user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
);

DROP POLICY "Users can insert outreach automations in their scope" ON public.outreach_automations;
DROP POLICY "Users can update outreach automations in their scope" ON public.outreach_automations;
DROP POLICY "Users can delete outreach automations in their scope" ON public.outreach_automations;

CREATE POLICY "Owners and org admins can insert outreach automations"
ON public.outreach_automations FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
);

CREATE POLICY "Owners and org admins can update outreach automations"
ON public.outreach_automations FOR UPDATE TO authenticated
USING (
  owner_user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
)
WITH CHECK (
  owner_user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
);

CREATE POLICY "Owners and org admins can delete outreach automations"
ON public.outreach_automations FOR DELETE TO authenticated
USING (
  owner_user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
);