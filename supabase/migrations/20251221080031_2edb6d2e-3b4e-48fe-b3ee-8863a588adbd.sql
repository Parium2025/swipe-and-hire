-- Fix storage RLS policy to allow employers to view applicant files via job applications
-- The current policy only checks profile_view_permissions, but we need to also check job_applications

-- First, drop the existing policy
DROP POLICY IF EXISTS "Employers can view consented files" ON storage.objects;

-- Create an improved policy that checks BOTH profile_view_permissions AND job_applications
CREATE POLICY "Employers can view consented files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'job-applications' 
  AND (
    -- Option 1: Via explicit profile_view_permissions
    EXISTS (
      SELECT 1 FROM public.profile_view_permissions pvp
      WHERE pvp.profile_id::text = (storage.foldername(name))[1]
      AND pvp.viewer_id = auth.uid()
      AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
    )
    OR
    -- Option 2: Via job application (employer has received an application from this user)
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      JOIN public.job_postings jp ON ja.job_id = jp.id
      WHERE ja.applicant_id::text = (storage.foldername(name))[1]
      AND jp.employer_id = auth.uid()
    )
  )
);