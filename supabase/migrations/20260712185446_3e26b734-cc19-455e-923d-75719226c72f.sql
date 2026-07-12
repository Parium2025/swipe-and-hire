
-- =========================================================
-- 1. COMPANY_REVIEWS: Dölj anonym recensents identitet
-- =========================================================
ALTER TABLE public.company_reviews ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.company_reviews ADD COLUMN IF NOT EXISTS hidden_author_id UUID;

-- Ingen roll får läsa hidden_author_id via API
REVOKE SELECT (hidden_author_id) ON public.company_reviews FROM anon, authenticated;

-- Migrera befintliga anonyma rader
UPDATE public.company_reviews
SET hidden_author_id = user_id, user_id = NULL
WHERE is_anonymous = true AND hidden_author_id IS NULL AND user_id IS NOT NULL;

-- Trigger: säkerställ att anonyma reviews aldrig exponerar user_id
CREATE OR REPLACE FUNCTION public.scrub_anonymous_review_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_anonymous = true THEN
    NEW.hidden_author_id := COALESCE(NEW.hidden_author_id, NEW.user_id, auth.uid());
    NEW.user_id := NULL;
  ELSE
    NEW.user_id := COALESCE(NEW.user_id, auth.uid());
    NEW.hidden_author_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scrub_anonymous_review_author ON public.company_reviews;
CREATE TRIGGER trg_scrub_anonymous_review_author
BEFORE INSERT OR UPDATE ON public.company_reviews
FOR EACH ROW EXECUTE FUNCTION public.scrub_anonymous_review_author();

-- Uppdatera policies så ägare kan redigera/radera även anonyma reviews
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.company_reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.company_reviews;

CREATE POLICY "Users can update their own reviews"
ON public.company_reviews FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = hidden_author_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = hidden_author_id);

CREATE POLICY "Users can delete their own reviews"
ON public.company_reviews FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = hidden_author_id);

-- =========================================================
-- 2. PROFILES: Blockera PII-läckage till oinloggade
-- =========================================================
-- Återkalla känsliga kolumner från anon (den publika policyn tillåter fortsatt ROW-läsning,
-- men PostgREST returnerar bara kolumner som rollen har SELECT på).
REVOKE SELECT (
  phone, email, birth_date, org_number, address, postal_code, home_location,
  cv_url, video_url, profile_file_name,
  interview_office_address, interview_office_instructions,
  interview_video_link, interview_default_message, interview_video_default_message,
  background_location_enabled, last_active_at
) ON public.profiles FROM anon;

-- =========================================================
-- 3. NY: Arbetsgivare (+ organisationsmedlemmar) ser full ansökarprofil
-- =========================================================
CREATE POLICY "Employers can view applicant profiles for their jobs"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.job_applications ja
    JOIN public.job_postings jp ON jp.id = ja.job_id
    WHERE ja.applicant_id = profiles.user_id
      AND (
        jp.employer_id = auth.uid()
        OR (
          public.get_user_organization_id(auth.uid()) IS NOT NULL
          AND public.get_user_organization_id(auth.uid()) = public.get_user_organization_id(jp.employer_id)
        )
      )
  )
);

-- =========================================================
-- 4. USER_SESSIONS: Ta bort från Realtime (session_token exponering)
-- =========================================================
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_sessions;

-- =========================================================
-- 5. STORAGE: message-attachments — endast deltagare
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view message attachments" ON storage.objects;

-- =========================================================
-- 6. STORAGE: company-logos / job-images — ägar-koll på DELETE/UPDATE
-- =========================================================
DROP POLICY IF EXISTS "Users can delete public bucket files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update public bucket files" ON storage.objects;

CREATE POLICY "Users can delete their own public bucket files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = ANY (ARRAY['company-logos'::text, 'job-images'::text])
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR owner = auth.uid()
  )
);

CREATE POLICY "Users can update their own public bucket files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = ANY (ARRAY['company-logos'::text, 'job-images'::text])
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR owner = auth.uid()
  )
)
WITH CHECK (
  bucket_id = ANY (ARRAY['company-logos'::text, 'job-images'::text])
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR owner = auth.uid()
  )
);

-- =========================================================
-- 7. Rätta search_path på interna funktioner
-- =========================================================
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
