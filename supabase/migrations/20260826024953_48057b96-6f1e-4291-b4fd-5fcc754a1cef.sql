CREATE TABLE public.organization_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','recruiter','viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX organization_invitations_pending_unique
  ON public.organization_invitations (organization_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX organization_invitations_org_idx ON public.organization_invitations (organization_id, created_at DESC);
CREATE INDEX organization_invitations_email_idx ON public.organization_invitations (lower(email)) WHERE status = 'pending';

GRANT SELECT, UPDATE ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view their invitations"
ON public.organization_invitations FOR SELECT TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can revoke their invitations"
ON public.organization_invitations FOR UPDATE TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER organization_invitations_updated_at
BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();