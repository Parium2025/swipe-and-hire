-- Create storage bucket for job application files
INSERT INTO storage.buckets (id, name, public) VALUES ('job-applications', 'job-applications', false);

-- Create RLS policies for job application files
CREATE POLICY "Users can upload their own application files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-applications' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own application files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'job-applications' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own application files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'job-applications' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own application files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'job-applications' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);