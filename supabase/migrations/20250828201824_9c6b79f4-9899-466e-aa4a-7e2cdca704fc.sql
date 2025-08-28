-- Låsa upp säkerhetsrestriktioner för jobbplattformen

-- 1. Uppdatera filvalidering för att tillåta fler filtyper
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
  -- Validate file size (max 50MB för CV:er och dokument)
  IF file_size > 52428800 THEN
    RETURN false;
  END IF;
  
  -- Tillåt alla vanliga filtyper för jobbansökningar
  -- Bilder, videos, dokument, arkiv etc.
  IF content_type LIKE 'image/%' OR 
     content_type LIKE 'video/%' OR
     content_type LIKE 'application/pdf' OR
     content_type LIKE 'application/msword' OR
     content_type LIKE 'application/vnd.openxmlformats-officedocument%' OR
     content_type LIKE 'application/zip' OR
     content_type LIKE 'application/x-rar%' OR
     content_type LIKE 'text/%' OR
     content_type LIKE 'application/json' OR
     content_type = 'application/octet-stream' THEN
    RETURN true;
  END IF;
  
  -- Blockera endast riktigt farliga executables
  IF lower(file_name) LIKE '%.exe' OR 
     lower(file_name) LIKE '%.bat' OR 
     lower(file_name) LIKE '%.cmd' OR
     lower(file_name) LIKE '%.scr' THEN
    RETURN false;
  END IF;
  
  -- Annars tillåt filen
  RETURN true;
END;
$$;

-- 2. Ta bort den restriktiva RLS-policyn för arbetsgivare
DROP POLICY IF EXISTS "Employers can view limited job seeker info with permission" ON public.profiles;

-- 3. Skapa en mer öppen policy för arbetsgivare att se fullständig profilinformation
CREATE POLICY "Employers can view full job seeker profiles with permission" ON public.profiles
FOR SELECT
USING (
  role = 'job_seeker' 
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('employer', 'recruiter', 'company_admin')
    AND ur.is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM profile_view_permissions pvp
    WHERE pvp.job_seeker_id = profiles.user_id
    AND pvp.employer_id = auth.uid()
    AND pvp.is_active = true
    AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  )
);

-- 4. Uppdatera triggern för att tillåta mer flexibel filuppladdning
DROP TRIGGER IF EXISTS sanitize_filename_trigger ON storage.objects;
CREATE TRIGGER sanitize_filename_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'job-applications')
  EXECUTE FUNCTION public.sanitize_storage_filename();

-- 5. Kommentera bort den mycket restriktiva storage-policyn
DROP POLICY IF EXISTS "Validate uploads before allowing" ON storage.objects;

-- Skapa en mer flexibel upload-policy
CREATE POLICY "Users can upload job-related files" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'job-applications' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.validate_file_upload_secure(name, COALESCE((metadata->>'size')::bigint, 0), COALESCE(metadata->>'mimetype', ''))
);