-- Fix sanitize_storage_filename to preserve folder path and only sanitize basename
CREATE OR REPLACE FUNCTION public.sanitize_storage_filename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  path_prefix text;
  base_name text;
  sanitized_base text;
BEGIN
  -- Split the incoming name into path prefix and base filename
  path_prefix := regexp_replace(NEW.name, '/[^/]*$', ''); -- everything before last '/'
  base_name := regexp_replace(NEW.name, '^.*/', '');      -- part after last '/'

  -- Sanitize only the base file name
  sanitized_base := public.sanitize_filename(base_name);

  -- Reassemble path + sanitized filename
  IF path_prefix = '' THEN
    NEW.name := sanitized_base;
  ELSE
    NEW.name := path_prefix || '/' || sanitized_base;
  END IF;

  -- Validate the upload (allow when metadata missing by defaulting mimetype)
  IF NOT public.validate_file_upload_secure(
    NEW.name,
    COALESCE((NEW.metadata->>'size')::bigint, 0),
    COALESCE(NEW.metadata->>'mimetype', 'application/octet-stream')
  ) THEN
    RAISE EXCEPTION 'File upload validation failed for: %', NEW.name;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger to ensure it points to updated function
DROP TRIGGER IF EXISTS sanitize_filename_trigger ON storage.objects;
CREATE TRIGGER sanitize_filename_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'job-applications')
  EXECUTE FUNCTION public.sanitize_storage_filename();