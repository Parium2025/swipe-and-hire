-- Add enhanced file upload validation function
CREATE OR REPLACE FUNCTION public.validate_file_upload_secure(
  file_name text,
  file_size bigint,
  content_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN  
  -- Validate file size (max 10MB for videos, 5MB for images)
  IF content_type LIKE 'video/%' AND file_size > 10485760 THEN
    RETURN false;
  END IF;
  
  IF content_type LIKE 'image/%' AND file_size > 5242880 THEN
    RETURN false;
  END IF;
  
  -- Validate content type (only images and videos)
  IF content_type NOT LIKE 'image/%' AND content_type NOT LIKE 'video/%' THEN
    RETURN false;
  END IF;
  
  -- Block potentially dangerous file extensions
  IF lower(file_name) LIKE '%.exe' OR 
     lower(file_name) LIKE '%.bat' OR 
     lower(file_name) LIKE '%.sh' OR 
     lower(file_name) LIKE '%.php' OR
     lower(file_name) LIKE '%.js' OR
     lower(file_name) LIKE '%.html' OR
     lower(file_name) LIKE '%.svg' OR
     lower(file_name) LIKE '%.script' THEN
    RETURN false;
  END IF;
  
  -- Validate video formats (only allow safe formats)
  IF content_type LIKE 'video/%' AND 
     content_type NOT IN ('video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo') THEN
    RETURN false;
  END IF;
  
  -- Validate image formats (only allow safe formats)
  IF content_type LIKE 'image/%' AND 
     content_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif') THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Add function to sanitize file names
CREATE OR REPLACE FUNCTION public.sanitize_filename(filename text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove any path traversal attempts
  filename := regexp_replace(filename, '\.\./|\.\.\\', '', 'g');
  
  -- Remove or replace dangerous characters
  filename := regexp_replace(filename, '[<>:"/\\|?*]', '_', 'g');
  
  -- Ensure filename isn't too long
  IF length(filename) > 255 THEN
    filename := left(filename, 255);
  END IF;
  
  RETURN filename;
END;
$$;

-- Create trigger to automatically sanitize filenames on upload
CREATE OR REPLACE FUNCTION public.sanitize_storage_filename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- Sanitize the filename
  NEW.name := public.sanitize_filename(NEW.name);
  
  -- Validate the upload
  IF NOT public.validate_file_upload_secure(
    NEW.name, 
    COALESCE((NEW.metadata->>'size')::bigint, 0),
    COALESCE(NEW.metadata->>'mimetype', '')
  ) THEN
    RAISE EXCEPTION 'File upload validation failed for: %', NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply the trigger to storage.objects for the job-applications bucket
DROP TRIGGER IF EXISTS sanitize_filename_trigger ON storage.objects;
CREATE TRIGGER sanitize_filename_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'job-applications')
  EXECUTE FUNCTION public.sanitize_storage_filename();