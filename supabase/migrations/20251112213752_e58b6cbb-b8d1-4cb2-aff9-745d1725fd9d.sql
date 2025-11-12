-- KRITISK FIX: Tillåt arbetsgivare att se kandidatmedia när de har permission
-- Drop gamla policies för job-applications bucket
DROP POLICY IF EXISTS "Users can view their own files only" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload validated files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload to job-applications (bucket-level)" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files only" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files only" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload job-related files" ON storage.objects;

-- 1. SELECT: Användare ser sina egna filer + arbetsgivare med permission ser kandidatfiler
CREATE POLICY "job_applications_select_secure" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'job-applications' 
  AND (
    -- Användare ser sina egna filer
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    OR
    -- Arbetsgivare med valid permission ser kandidatfiler
    (
      auth.uid() IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.profile_view_permissions pvp
        WHERE pvp.employer_id = auth.uid()
          AND pvp.job_seeker_id = ((storage.foldername(name))[1])::uuid
          AND pvp.is_active = true
          AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
      )
    )
    OR
    -- Super admins ser allt
    public.is_super_admin(auth.uid())
  )
);

-- 2. INSERT: Autentiserade användare kan ladda upp under sin egen user-id
CREATE POLICY "job_applications_insert_secure" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-applications'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. UPDATE: Endast ägaren kan uppdatera sina egna filer
CREATE POLICY "job_applications_update_secure" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'job-applications'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. DELETE: Endast ägaren kan radera sina egna filer
CREATE POLICY "job_applications_delete_secure" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'job-applications'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);