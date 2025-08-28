-- PHASE 1: STORAGE SECURITY - Make bucket private and add consent-based policies

-- Make job-applications bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'job-applications';

-- Create function to check if employer can view job seeker profile
CREATE OR REPLACE FUNCTION public.can_view_job_seeker_profile(employer_uuid uuid, seeker_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = employer_uuid 
    AND ur.role IN ('employer', 'recruiter', 'company_admin')
    AND ur.is_active = true
  ) AND EXISTS(
    SELECT 1 FROM public.profile_view_permissions pvp
    WHERE pvp.job_seeker_id = seeker_uuid
    AND pvp.employer_id = employer_uuid
    AND pvp.is_active = true
    AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  );
$$;

-- Storage policies for job-applications bucket

-- Users can manage their own files
CREATE POLICY "Users can upload their own files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'job-applications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'job-applications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'job-applications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'job-applications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Employers can view job seeker files only with consent
CREATE POLICY "Employers can view job seeker files with permission" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'job-applications' 
  AND can_view_job_seeker_profile(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Super admins can manage all files
CREATE POLICY "Super admins can manage all job application files" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id = 'job-applications' 
  AND is_super_admin(auth.uid())
);