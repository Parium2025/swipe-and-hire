
-- 1. Add fingerprint column
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS content_fingerprint text;

-- 2. Normalizer: lowercase, strip punctuation, collapse whitespace
CREATE OR REPLACE FUNCTION public.normalize_job_text(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(
      regexp_replace(
        regexp_replace(lower(coalesce(t, '')), '[[:punct:]]', '', 'g'),
        '\s+', ' ', 'g'
      ),
      ''
    ),
    ''
  );
$$;

-- 3. Fingerprint computer — includes structural fields verbatim so time/day/salary changes always change fingerprint
CREATE OR REPLACE FUNCTION public.compute_job_fingerprint(j public.job_postings)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT md5(
    public.normalize_job_text(j.title) || '|' ||
    public.normalize_job_text(j.description) || '|' ||
    public.normalize_job_text(j.requirements) || '|' ||
    public.normalize_job_text(j.occupation) || '|' ||
    public.normalize_job_text(j.workplace_city) || '|' ||
    public.normalize_job_text(j.workplace_municipality) || '|' ||
    coalesce(j.employment_type, '') || '|' ||
    coalesce(j.work_schedule, '') || '|' ||
    coalesce(j.work_start_time, '') || '|' ||
    coalesce(j.work_end_time, '') || '|' ||
    coalesce(j.salary_min::text, '') || '|' ||
    coalesce(j.salary_max::text, '') || '|' ||
    coalesce(j.salary_type, '') || '|' ||
    coalesce(j.start_date::text, '') || '|' ||
    coalesce(j.duration_amount::text, '') || '|' ||
    coalesce(j.duration_unit, '') || '|' ||
    coalesce(array_to_string(j.part_time_days, ','), '') || '|' ||
    coalesce(array_to_string(j.part_time_shifts, ','), '')
  );
$$;

-- 4. BEFORE INSERT/UPDATE trigger — set fingerprint and enforce anti-spam rules
CREATE OR REPLACE FUNCTION public.job_postings_fingerprint_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_publish timestamptz;
  v_dup_id uuid;
  v_is_publish boolean;
BEGIN
  -- Always compute fingerprint
  NEW.content_fingerprint := public.compute_job_fingerprint(NEW);

  -- Only enforce anti-spam rules when this row is (becoming) an active, non-deleted posting
  v_is_publish := COALESCE(NEW.is_active, false) = true
                  AND NEW.deleted_at IS NULL
                  AND (
                    TG_OP = 'INSERT'
                    OR COALESCE(OLD.is_active, false) = false
                  );

  IF NOT v_is_publish THEN
    RETURN NEW;
  END IF;

  -- Cooldown: 20 seconds between publishes per employer
  SELECT max(created_at) INTO v_recent_publish
  FROM public.job_postings
  WHERE employer_id = NEW.employer_id
    AND is_active = true
    AND deleted_at IS NULL
    AND (TG_OP = 'INSERT' OR id <> NEW.id)
    AND created_at > (now() - interval '20 seconds');

  IF v_recent_publish IS NOT NULL THEN
    RAISE EXCEPTION 'PARIUM_PUBLISH_COOLDOWN: Vänta några sekunder innan du publicerar nästa annons.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Duplicate: same employer already has an active posting with identical content
  SELECT id INTO v_dup_id
  FROM public.job_postings
  WHERE employer_id = NEW.employer_id
    AND is_active = true
    AND deleted_at IS NULL
    AND content_fingerprint = NEW.content_fingerprint
    AND (TG_OP = 'INSERT' OR id <> NEW.id)
  LIMIT 1;

  IF v_dup_id IS NOT NULL THEN
    RAISE EXCEPTION 'PARIUM_DUPLICATE_JOB: Du har redan en aktiv annons med identiskt innehåll. Ändra något (t.ex. tid, dag, lön eller några ord i beskrivningen) innan du publicerar igen.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_postings_fingerprint_guard ON public.job_postings;
CREATE TRIGGER trg_job_postings_fingerprint_guard
BEFORE INSERT OR UPDATE ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.job_postings_fingerprint_guard();

-- 5. Backfill fingerprints for existing rows
UPDATE public.job_postings
SET content_fingerprint = public.compute_job_fingerprint(job_postings.*)
WHERE content_fingerprint IS NULL;

-- 6. Index for the duplicate lookup path
CREATE INDEX IF NOT EXISTS idx_job_postings_employer_fingerprint_active
  ON public.job_postings (employer_id, content_fingerprint)
  WHERE is_active = true AND deleted_at IS NULL;
