-- Fix: storage policy for employer access to candidate files was mistakenly granted to role "public".
-- It must be granted to "authenticated" so logged-in employers can generate signed URLs.

DROP POLICY IF EXISTS "Employers can view consented files" ON storage.objects;

CREATE POLICY "Employers can view consented files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  (bucket_id = 'job-applications'::text)
  AND (
    EXISTS (
      SELECT 1
      FROM profile_view_permissions pvp
      WHERE (pvp.profile_id)::text = (storage.foldername(objects.name))[1]
        AND pvp.viewer_id = auth.uid()
        AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
    )
    OR EXISTS (
      SELECT 1
      FROM job_applications ja
      JOIN job_postings jp ON ja.job_id = jp.id
      WHERE (ja.applicant_id)::text = (storage.foldername(objects.name))[1]
        AND jp.employer_id = auth.uid()
    )
  )
);
