-- Kollegor i samma aktiva organisation får se varandras AKTUELLA profilbild
-- (inte originalfil, CV eller video). Utan detta visades initialer i
-- aktivitetsloggen och "tillagd av" när kollegorna inte delade en chatt.
CREATE OR REPLACE FUNCTION public.can_view_colleague_profile_image(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = public.try_uuid((storage.foldername(p_name))[1])
        AND p.user_id <> auth.uid()
        AND p.profile_image_url = p_name
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur1
          JOIN public.user_roles ur2 ON ur2.organization_id = ur1.organization_id
          WHERE ur1.user_id = auth.uid()
            AND ur2.user_id = p.user_id
            AND ur1.is_active = true
            AND ur2.is_active = true
            AND ur1.organization_id IS NOT NULL
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_colleague_profile_image(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_colleague_profile_image(text) TO authenticated;

DROP POLICY IF EXISTS "Org colleagues can view current profile images" ON storage.objects;
CREATE POLICY "Org colleagues can view current profile images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-applications'
  AND public.can_view_colleague_profile_image(name)
);