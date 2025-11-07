-- Create public bucket for profile media (images and videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-media',
  'profile-media',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for profile-media bucket
CREATE POLICY "Anyone can view profile media"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-media');

CREATE POLICY "Authenticated users can upload their own profile media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);