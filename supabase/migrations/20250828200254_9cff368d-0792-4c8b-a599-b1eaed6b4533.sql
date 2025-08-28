-- Security improvements for the system

-- Add audit logging table for sensitive operations  
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs" ON public.security_audit_log
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Create function for secure token generation
CREATE OR REPLACE FUNCTION public.create_secure_confirmation_token()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token uuid;
BEGIN
  -- Generate a cryptographically secure random token
  new_token := gen_random_uuid();
  
  -- Log token creation for audit purposes (only if audit table exists)
  BEGIN
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      table_name
    ) VALUES (
      auth.uid(),
      'secure_token_created',
      'email_confirmations'
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Ignore if audit logging fails
      NULL;
  END;
  
  RETURN new_token;
END;
$$;

-- Add function to validate file uploads securely
CREATE OR REPLACE FUNCTION public.validate_file_upload(
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
  -- Log the file upload attempt
  BEGIN
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      table_name
    ) VALUES (
      auth.uid(),
      'file_upload_attempt',
      'storage'
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Continue even if logging fails
      NULL;
  END;
  
  -- Validate file size (max 10MB)
  IF file_size > 10485760 THEN
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
     lower(file_name) LIKE '%.html' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Add enhanced storage policies for job-applications bucket
CREATE POLICY "Validate uploads before allowing" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'job-applications' 
  AND auth.uid() IS NOT NULL
  AND public.validate_file_upload(name, (metadata->>'size')::bigint, (metadata->>'mimetype')::text)
);

-- Update existing storage policies to be more restrictive
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create more secure storage policies
CREATE POLICY "Authenticated users can upload validated files" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'job-applications' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.validate_file_upload(name, (metadata->>'size')::bigint, (metadata->>'mimetype')::text)
);

CREATE POLICY "Users can view their own files only" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'job-applications' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own files only" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'job-applications' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'job-applications' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own files only" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'job-applications' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);