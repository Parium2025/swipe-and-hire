-- Lägg till virus scanning hook (placeholder för framtida implementation)
CREATE OR REPLACE FUNCTION public.validate_file_upload_enhanced(
  file_name text, 
  file_size bigint, 
  content_type text,
  file_content bytea DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Befintliga valideringar
  IF file_size > 52428800 THEN -- 50MB
    RETURN false;
  END IF;
  
  -- Blockera potentiellt farliga filnamn
  IF lower(file_name) ~ '\.(exe|bat|cmd|scr|jar|com|pif|vbs|ws[fh])$' THEN
    RETURN false;
  END IF;
  
  -- Tillåt relevanta filtyper för jobbansökningar
  IF NOT (
    content_type LIKE 'image/%' OR 
    content_type LIKE 'video/%' OR
    content_type IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    )
  ) THEN
    RETURN false;
  END IF;
  
  -- Logga alla filuppladdningar för säkerhetsövervakning
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    metadata
  ) VALUES (
    auth.uid(),
    'file_upload_validated',
    'storage.objects',
    jsonb_build_object(
      'file_name', file_name,
      'file_size', file_size,
      'content_type', content_type,
      'timestamp', now()
    )
  );
  
  RETURN true;
END;
$$;

-- Förbättrad trigger för filvalidering
DROP TRIGGER IF EXISTS validate_file_upload_trigger ON storage.objects;
CREATE TRIGGER validate_file_upload_enhanced_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_storage_filename();