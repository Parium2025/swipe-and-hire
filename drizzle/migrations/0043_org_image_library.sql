CREATE OR REPLACE FUNCTION public.has_image_library_access(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND lower(email) = 'pariumab@hotmail.com') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin' AND COALESCE(is_active, true)) THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM public.get_active_plan_details(_user_id) p WHERE p.tier IN ('vaxa','pro'));
END $$;

CREATE TABLE public.org_image_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, storage_path)
);
CREATE INDEX org_image_library_org_created_idx ON public.org_image_library (organization_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.org_image_library TO authenticated;
GRANT ALL ON public.org_image_library TO service_role;
ALTER TABLE public.org_image_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read library" ON public.org_image_library FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()) AND public.has_image_library_access(auth.uid()));
CREATE POLICY "Org members add to library" ON public.org_image_library FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND organization_id = public.get_user_organization_id(auth.uid()) AND public.has_image_library_access(auth.uid()) AND storage_path LIKE auth.uid()::text || '/%');
CREATE POLICY "Org members remove from library" ON public.org_image_library FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()) AND public.has_image_library_access(auth.uid()));