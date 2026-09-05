DROP POLICY IF EXISTS "Conversation participants can view profile images" ON storage.objects;

CREATE POLICY "Conversation participants can view profile images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-applications'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1
    FROM public.get_chat_member_profiles(
      ARRAY[((storage.foldername(objects.name))[1])::uuid]
    ) AS chat_profile
    WHERE chat_profile.user_id = ((storage.foldername(objects.name))[1])::uuid
      AND chat_profile.profile_image_url = objects.name
  )
);