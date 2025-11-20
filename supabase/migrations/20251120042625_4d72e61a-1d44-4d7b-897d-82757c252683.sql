-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('job-applications', 'job-applications', false),
  ('company-logos', 'company-logos', true),
  ('job-images', 'job-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist and recreate
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
  DROP POLICY IF EXISTS "Employers can view consented files" ON storage.objects;
  DROP POLICY IF EXISTS "Public files are viewable" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload to public buckets" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update public bucket files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete public bucket files" ON storage.objects;
END $$;

-- Storage policies for job-applications (private)
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-applications' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'job-applications' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'job-applications' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'job-applications' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Employers can view applicant files they have permission for
CREATE POLICY "Employers can view consented files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-applications' AND
  EXISTS (
    SELECT 1 FROM profile_view_permissions pvp
    WHERE pvp.profile_id::text = (storage.foldername(name))[1]
    AND pvp.viewer_id = auth.uid()
    AND (pvp.expires_at IS NULL OR pvp.expires_at > NOW())
  )
);

-- Storage policies for public buckets
CREATE POLICY "Public files are viewable"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id IN ('company-logos', 'job-images'));

CREATE POLICY "Authenticated users can upload to public buckets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('company-logos', 'job-images'));

CREATE POLICY "Users can update public bucket files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('company-logos', 'job-images'));

CREATE POLICY "Users can delete public bucket files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('company-logos', 'job-images'));