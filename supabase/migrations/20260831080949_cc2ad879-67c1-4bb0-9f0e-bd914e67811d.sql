-- Server-owned revisions and an atomic compare-and-set boundary for a
-- jobseeker's single personal-notes row. This migration is intentionally
-- additive for existing content and remains compatible with legacy clients
-- until the separately staged contract migration is explicitly promoted.

ALTER TABLE public.jobseeker_notes
  ADD COLUMN IF NOT EXISTS revision bigint DEFAULT 1;

ALTER TABLE public.jobseeker_notes
  ALTER COLUMN revision TYPE bigint USING revision::bigint,
  ALTER COLUMN revision SET DEFAULT 1;

UPDATE public.jobseeker_notes
SET revision = 1
WHERE revision IS NULL OR revision < 1;

ALTER TABLE public.jobseeker_notes
  ALTER COLUMN revision SET NOT NULL;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conname = 'jobseeker_notes_revision_positive'
      AND conrelid = 'public.jobseeker_notes'::regclass
  ) THEN
    ALTER TABLE public.jobseeker_notes
      ADD CONSTRAINT jobseeker_notes_revision_positive
      CHECK (revision > 0) NOT VALID;
  END IF;
END;
$constraint$;

ALTER TABLE public.jobseeker_notes
  VALIDATE CONSTRAINT jobseeker_notes_revision_positive;

CREATE OR REPLACE FUNCTION public.initialize_jobseeker_notes_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  -- Legacy direct inserts remain temporarily supported during the expand
  -- rollout, but callers must never be able to choose the CAS baseline.
  NEW.revision := 1;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.initialize_jobseeker_notes_revision()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER initialize_jobseeker_notes_revision_before_insert
BEFORE INSERT ON public.jobseeker_notes
FOR EACH ROW
EXECUTE FUNCTION public.initialize_jobseeker_notes_revision();

CREATE OR REPLACE FUNCTION public.bump_jobseeker_notes_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.bump_jobseeker_notes_revision()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER bump_jobseeker_notes_revision_before_update
BEFORE UPDATE ON public.jobseeker_notes
FOR EACH ROW
EXECUTE FUNCTION public.bump_jobseeker_notes_revision();

CREATE OR REPLACE FUNCTION public.save_jobseeker_note(
  p_content text,
  p_expected_revision bigint,
  p_expected_user_id uuid
)
RETURNS TABLE (
  save_status text,
  note_id uuid,
  server_content text,
  server_revision bigint,
  server_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_content text := p_content;
  v_note_id uuid;
  v_server_content text;
  v_server_revision bigint;
  v_server_updated_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  -- Bind the immutable UI/account scope to the JWT subject at execution time.
  -- This prevents a retained callback from account A writing its content after
  -- the Supabase session has already switched to account B.
  IF p_expected_user_id IS NULL OR p_expected_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Authenticated user changed before save'
      USING ERRCODE = '42501';
  END IF;

  IF p_content IS NULL THEN
    RAISE EXCEPTION 'Content must not be null'
      USING ERRCODE = '22004';
  END IF;

  -- Protect Postgres, Realtime and browser caches from unbounded rich-text
  -- payloads while leaving ample room for a personal notes document.
  IF octet_length(v_content) > 500000 THEN
    RAISE EXCEPTION 'Content exceeds the 500000 byte limit'
      USING ERRCODE = '22001';
  END IF;

  IF p_expected_revision IS NULL OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'Expected revision must be zero or greater'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    note.id,
    note.content,
    note.revision,
    note.updated_at
  INTO
    v_note_id,
    v_server_content,
    v_server_revision,
    v_server_updated_at
  FROM public.jobseeker_notes AS note
  WHERE note.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN
      RETURN QUERY
      SELECT
        'conflict'::text,
        NULL::uuid,
        NULL::text,
        0::bigint,
        NULL::timestamptz;
      RETURN;
    END IF;

    INSERT INTO public.jobseeker_notes AS note (user_id, content, revision)
    VALUES (v_user_id, v_content, 1)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING
      note.id,
      note.content,
      note.revision,
      note.updated_at
    INTO
      v_note_id,
      v_server_content,
      v_server_revision,
      v_server_updated_at;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        'saved'::text,
        v_note_id,
        v_server_content,
        v_server_revision,
        v_server_updated_at;
      RETURN;
    END IF;

    -- A concurrent first insert won the unique(user_id) race. Lock and
    -- evaluate that committed row using the same idempotency/CAS rules.
    SELECT
      note.id,
      note.content,
      note.revision,
      note.updated_at
    INTO
      v_note_id,
      v_server_content,
      v_server_revision,
      v_server_updated_at
    FROM public.jobseeker_notes AS note
    WHERE note.user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- The row that won the insert race was deleted before it could be
      -- locked. Return an explicit conflict instead of a false NULL "saved".
      RETURN QUERY
      SELECT
        'conflict'::text,
        NULL::uuid,
        NULL::text,
        0::bigint,
        NULL::timestamptz;
      RETURN;
    END IF;
  END IF;

  IF v_server_content IS NOT DISTINCT FROM v_content THEN
    RETURN QUERY
    SELECT
      'already_saved'::text,
      v_note_id,
      v_server_content,
      v_server_revision,
      v_server_updated_at;
    RETURN;
  END IF;

  IF p_expected_revision <> v_server_revision THEN
    RETURN QUERY
    SELECT
      'conflict'::text,
      v_note_id,
      v_server_content,
      v_server_revision,
      v_server_updated_at;
    RETURN;
  END IF;

  UPDATE public.jobseeker_notes AS note
  SET content = v_content
  WHERE note.id = v_note_id
    AND note.user_id = v_user_id
  RETURNING
    note.id,
    note.content,
    note.revision,
    note.updated_at
  INTO
    v_note_id,
    v_server_content,
    v_server_revision,
    v_server_updated_at;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'conflict'::text,
      NULL::uuid,
      NULL::text,
      0::bigint,
      NULL::timestamptz;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'saved'::text,
    v_note_id,
    v_server_content,
    v_server_revision,
    v_server_updated_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_jobseeker_note(text, bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_jobseeker_note(text, bigint, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_jobseeker_note(text, bigint, uuid) TO authenticated;

COMMENT ON COLUMN public.jobseeker_notes.revision IS
  'Server-owned monotonically increasing revision used for compare-and-set saves.';

COMMENT ON FUNCTION public.save_jobseeker_note(text, bigint, uuid) IS
  'Atomically saves the authenticated jobseeker note or returns the competing server snapshot.';