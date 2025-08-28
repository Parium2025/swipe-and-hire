-- Create function for secure token generation (if not exists)
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
  
  -- Log token creation for audit purposes (if audit table exists)
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

-- Create additional security function for profile data validation
CREATE OR REPLACE FUNCTION public.validate_profile_data(
  birth_date date,
  phone text,
  cv_url text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate birth date (must be at least 16 years old)
  IF birth_date IS NOT NULL AND birth_date > (CURRENT_DATE - INTERVAL '16 years') THEN
    RETURN false;
  END IF;
  
  -- Validate phone number format (Swedish format)
  IF phone IS NOT NULL AND phone !~ '^(\+46|0)[1-9][0-9]{7,9}$' THEN
    RETURN false;
  END IF;
  
  -- Validate CV URL is from our storage bucket
  IF cv_url IS NOT NULL AND cv_url NOT LIKE '%/job-applications/%' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;