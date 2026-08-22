CREATE OR REPLACE FUNCTION public.is_allowed_attachment_path(object_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(object_name, '^.*\.', '')) = ANY (ARRAY[
    'jpg','jpeg','png','gif','webp','bmp','svg','heic','heif','avif','tif','tiff',
    'mp4','m4v','mov','webm','mkv','3gp','3g2','avi','mpeg','mpg',
    'mp3','m4a','aac','wav','ogg','oga','opus','flac','amr',
    'pdf','doc','docx','xls','xlsx','ppt','pptx','rtf','odt','ods','odp',
    'pages','numbers','key','txt','csv','md','json',
    'zip','rar','7z','gz','tar'
  ]) AND object_name ~ '\.';
$$;

DROP POLICY IF EXISTS "Users can upload message attachments" ON storage.objects;

CREATE POLICY "Users can upload message attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] IS NOT NULL
  AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_allowed_attachment_path(name)
  AND EXISTS (
    SELECT 1 FROM public.conversation_members cmem
    WHERE cmem.user_id = auth.uid()
      AND cmem.conversation_id = ((storage.foldername(objects.name))[2])::uuid
  )
);