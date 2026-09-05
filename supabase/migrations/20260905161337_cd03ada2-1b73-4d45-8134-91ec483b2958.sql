CREATE POLICY "Conversation participants can view profile images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-applications'
  AND EXISTS (
    SELECT 1
    FROM public.profiles profile_owner
    WHERE profile_owner.profile_image_url = objects.name
      AND EXISTS (
        SELECT 1
        FROM public.conversation_members viewer_membership
        JOIN public.conversation_members owner_membership
          ON owner_membership.conversation_id = viewer_membership.conversation_id
        WHERE viewer_membership.user_id = auth.uid()
          AND owner_membership.user_id = profile_owner.user_id
      )
  )
);