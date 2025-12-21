-- Safe text->uuid conversion helper for RLS policies
CREATE OR REPLACE FUNCTION public.try_uuid(p_text text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN p_text::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

-- Update storage access so org recruiters can fetch candidate media via signed URLs
DROP POLICY IF EXISTS "Employers can view consented files" ON storage.objects;

CREATE POLICY "Employers can view consented files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-applications'
  AND (
    -- Explicit permission
    EXISTS (
      SELECT 1
      FROM public.profile_view_permissions pvp
      WHERE (pvp.profile_id)::text = (storage.foldername(objects.name))[1]
        AND pvp.viewer_id = auth.uid()
        AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
    )
    OR (
      -- Applied to an employer in the same organization (via SECURITY DEFINER function)
      public.try_uuid((storage.foldername(objects.name))[1]) IS NOT NULL
      AND public.has_applied_to_employer(public.try_uuid((storage.foldername(objects.name))[1]), auth.uid())
    )
  )
);