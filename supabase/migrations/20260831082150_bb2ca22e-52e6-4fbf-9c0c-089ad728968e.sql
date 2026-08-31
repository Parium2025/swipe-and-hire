-- Expand-only rollout for custom email confirmation capabilities.
--
-- The legacy email_confirmations row and its user_id uniqueness are kept so
-- the previous edge functions continue to work while the new functions roll
-- out. New code stores every capability in email_confirmation_tokens, making
-- concurrent resend links independently valid, and dual-writes the newest raw
-- UUID to the legacy row for backwards compatibility. A later, separately
-- observed contract migration may remove the legacy raw token.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.email_confirmations
  ADD COLUMN IF NOT EXISTS token_digest text;

-- Historical projects created this column as NOT NULL, while newer snapshots
-- omitted it. The new pipeline does not depend on email being present in this
-- bearer-capability table, but supplies it when the column exists.
DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_confirmations'
      AND column_name = 'email'
  ) THEN
    ALTER TABLE public.email_confirmations ALTER COLUMN email DROP NOT NULL;
  END IF;
END
$block$;

-- Preserve the legacy token column and its original UUID/text type. A token
-- that is already a 64-char digest came from an interrupted earlier rollout;
-- do not hash it a second time.
UPDATE public.email_confirmations
SET token_digest = CASE
  WHEN token::text ~ '^[0-9a-fA-F]{64}$' THEN lower(token::text)
  ELSE encode(extensions.digest(token::text, 'sha256'), 'hex')
END
WHERE token IS NOT NULL
  AND token_digest IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_confirmations_token_digest_idx
  ON public.email_confirmations (token_digest)
  WHERE token_digest IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_confirmations_unconfirmed_expires_at_idx
  ON public.email_confirmations (expires_at, id)
  WHERE confirmed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.email_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_digest text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  CONSTRAINT email_confirmation_tokens_digest_format
    CHECK (token_digest ~ '^[0-9a-f]{64}$')
);

ALTER TABLE public.email_confirmation_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_confirmation_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_confirmation_tokens TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS email_confirmation_tokens_digest_idx
  ON public.email_confirmation_tokens (token_digest);

CREATE INDEX IF NOT EXISTS email_confirmation_tokens_active_user_idx
  ON public.email_confirmation_tokens (user_id, expires_at DESC)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS email_confirmation_tokens_expires_at_idx
  ON public.email_confirmation_tokens (expires_at, id);

-- Historical rows are not guaranteed to have an auth.users foreign key.
-- Report orphan volume for rollout observability and skip those rows during
-- the FK-backed expansion instead of aborting the entire migration.
DO $block$
DECLARE
  v_orphan_count bigint;
BEGIN
  SELECT count(*)
  INTO v_orphan_count
  FROM public.email_confirmations AS ec
  LEFT JOIN auth.users AS auth_user ON auth_user.id = ec.user_id
  WHERE ec.token_digest IS NOT NULL
    AND auth_user.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE NOTICE 'Skipping % orphaned legacy email confirmation rows during digest expansion',
      v_orphan_count;
  END IF;
END
$block$;

-- Mirror currently usable legacy capabilities into the multi-token table.
-- ON CONFLICT makes the expansion safe to re-run.
INSERT INTO public.email_confirmation_tokens (
  user_id,
  token_digest,
  created_at,
  expires_at,
  consumed_at
)
SELECT
  ec.user_id,
  ec.token_digest,
  COALESCE(ec.created_at, statement_timestamp()),
  ec.expires_at,
  ec.confirmed_at
FROM public.email_confirmations AS ec
JOIN auth.users AS auth_user ON auth_user.id = ec.user_id
WHERE ec.token_digest IS NOT NULL
ON CONFLICT (token_digest) DO NOTHING;

-- Persist the new digest capability first and dual-write the raw UUID to the
-- legacy row in the same transaction. Dynamic SQL accommodates historical
-- UUID and text token columns as well as the optional email column.
CREATE OR REPLACE FUNCTION public.issue_email_confirmation_token(
  _user_id uuid,
  _email text,
  _raw_token uuid,
  _token_digest text,
  _expires_at timestamp with time zone
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_confirmation_id uuid;
  v_token_type text;
  v_has_email boolean;
  v_token_expression text;
  v_email_update text;
  v_email_column text;
  v_email_value text;
  v_updated bigint;
BEGIN
  IF _user_id IS NULL
    OR _raw_token IS NULL
    OR _expires_at <= statement_timestamp()
    OR _token_digest !~ '^[0-9a-f]{64}$'
    OR lower(_token_digest) <>
      encode(extensions.digest(_raw_token::text, 'sha256'), 'hex')
  THEN
    RAISE EXCEPTION 'invalid email confirmation capability'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize only the legacy compatibility row. The canonical multi-token
  -- insert remains independent, so all concurrent resend links stay usable.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_user_id::text, 20260830223000)
  );

  INSERT INTO public.email_confirmation_tokens (
    user_id,
    token_digest,
    expires_at
  )
  VALUES (
    _user_id,
    lower(_token_digest),
    _expires_at
  )
  RETURNING id INTO v_confirmation_id;

  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
  INTO v_token_type
  FROM pg_catalog.pg_attribute AS a
  WHERE a.attrelid = 'public.email_confirmations'::regclass
    AND a.attname = 'token'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_confirmations'
      AND column_name = 'email'
  ) INTO v_has_email;

  v_token_expression := CASE
    WHEN v_token_type = 'uuid' THEN '$3::uuid'
    ELSE '$3::text'
  END;
  v_email_update := CASE
    WHEN v_has_email THEN ', email = $2'
    ELSE ''
  END;
  v_email_column := CASE
    WHEN v_has_email THEN ', email'
    ELSE ''
  END;
  v_email_value := CASE
    WHEN v_has_email THEN ', $2'
    ELSE ''
  END;

  EXECUTE pg_catalog.format(
    'UPDATE public.email_confirmations
       SET token = %s,
           token_digest = $4,
           expires_at = $5,
           confirmed_at = NULL%s
     WHERE user_id = $1',
    v_token_expression,
    v_email_update
  )
  USING _user_id, lower(btrim(_email)), _raw_token::text,
    lower(_token_digest), _expires_at;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    EXECUTE pg_catalog.format(
      'INSERT INTO public.email_confirmations
         (user_id, token, token_digest, expires_at, confirmed_at%s)
       VALUES ($1, %s, $4, $5, NULL%s)',
      v_email_column,
      v_token_expression,
      v_email_value
    )
    USING _user_id, lower(btrim(_email)), _raw_token::text,
      lower(_token_digest), _expires_at;
  END IF;

  RETURN v_confirmation_id;
END
$function$;

-- Read-only capability lookup. Digest-first handles all new tokens; the raw
-- comparison is deliberately retained during the rolling window because an
-- older edge function can update token without updating token_digest.
CREATE OR REPLACE FUNCTION public.lookup_email_confirmation_token(
  _token_digest text,
  _raw_token uuid
)
RETURNS TABLE (
  confirmation_id uuid,
  user_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF _raw_token IS NULL OR _token_digest !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ect.id, ect.user_id
  FROM public.email_confirmation_tokens AS ect
  WHERE ect.token_digest = lower(btrim(_token_digest))
    AND ect.consumed_at IS NULL
    AND ect.expires_at > statement_timestamp()
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ec.id, ec.user_id
  FROM public.email_confirmations AS ec
  WHERE ec.confirmed_at IS NULL
    AND ec.expires_at > statement_timestamp()
    AND (
      ec.token_digest = lower(btrim(_token_digest))
      OR ec.token::text = _raw_token::text
    )
  LIMIT 1;
END
$function$;

-- Finalize only after auth.admin.updateUserById has succeeded. The matched
-- capability is the CAS guard; successful confirmation invalidates every
-- remaining link for that user across both the new and legacy stores.
CREATE OR REPLACE FUNCTION public.finalize_email_confirmation_token(
  _confirmation_id uuid,
  _token_digest text,
  _raw_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF _confirmation_id IS NULL
    OR _raw_token IS NULL
    OR _token_digest !~ '^[0-9a-f]{64}$'
  THEN
    RETURN false;
  END IF;

  UPDATE public.email_confirmation_tokens AS ect
  SET consumed_at = statement_timestamp()
  WHERE ect.id = _confirmation_id
    AND ect.token_digest = lower(btrim(_token_digest))
    AND ect.consumed_at IS NULL
    AND ect.expires_at > statement_timestamp()
  RETURNING ect.user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    UPDATE public.email_confirmations AS ec
    SET confirmed_at = statement_timestamp()
    WHERE ec.id = _confirmation_id
      AND ec.confirmed_at IS NULL
      AND ec.expires_at > statement_timestamp()
      AND (
        ec.token_digest = lower(btrim(_token_digest))
        OR ec.token::text = _raw_token::text
      )
    RETURNING ec.user_id INTO v_user_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.email_confirmation_tokens
  SET consumed_at = COALESCE(consumed_at, statement_timestamp())
  WHERE user_id = v_user_id
    AND consumed_at IS NULL;

  UPDATE public.email_confirmations
  SET confirmed_at = COALESCE(confirmed_at, statement_timestamp())
  WHERE user_id = v_user_id
    AND confirmed_at IS NULL;

  RETURN true;
END
$function$;

-- Bounded, lock-friendly capability retention. Expiration never purges an
-- Auth user; the dedicated inactivity-retention workflow owns account deletion
-- with warnings and a separate grace period.
CREATE OR REPLACE FUNCTION public.cleanup_expired_email_confirmation_capabilities(
  _batch_size integer DEFAULT 1000
)
RETURNS TABLE (
  legacy_deleted integer,
  token_deleted integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_batch_size integer := LEAST(GREATEST(COALESCE(_batch_size, 1000), 1), 5000);
  v_legacy_deleted integer := 0;
  v_token_deleted integer := 0;
BEGIN
  WITH targets AS (
    SELECT ec.id
    FROM public.email_confirmations AS ec
    WHERE ec.expires_at < statement_timestamp()
      AND ec.confirmed_at IS NULL
    ORDER BY ec.expires_at, ec.id
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.email_confirmations AS ec
    USING targets
    WHERE ec.id = targets.id
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_legacy_deleted FROM deleted;

  WITH targets AS (
    SELECT ect.id
    FROM public.email_confirmation_tokens AS ect
    WHERE ect.expires_at < statement_timestamp()
    ORDER BY ect.expires_at, ect.id
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.email_confirmation_tokens AS ect
    USING targets
    WHERE ect.id = targets.id
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_token_deleted FROM deleted;

  RETURN QUERY SELECT v_legacy_deleted, v_token_deleted;
END
$function$;

REVOKE ALL ON FUNCTION public.issue_email_confirmation_token(uuid,text,uuid,text,timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_email_confirmation_token(uuid,text,uuid,text,timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.lookup_email_confirmation_token(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_email_confirmation_token(text,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_email_confirmation_token(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_email_confirmation_token(uuid,text,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_expired_email_confirmation_capabilities(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_email_confirmation_capabilities(integer) TO service_role;

COMMENT ON TABLE public.email_confirmation_tokens IS
  'Digest-only, multi-token store for one-time custom email confirmations.';
COMMENT ON FUNCTION public.issue_email_confirmation_token(uuid,text,uuid,text,timestamp with time zone) IS
  'Atomically persists a digest capability before mail delivery and dual-writes the legacy raw token during expand rollout.';
COMMENT ON FUNCTION public.lookup_email_confirmation_token(text,uuid) IS
  'Looks up one unexpired confirmation capability without consuming it; service role only.';
COMMENT ON FUNCTION public.finalize_email_confirmation_token(uuid,text,uuid) IS
  'Final CAS after auth confirmation succeeds; service role only.';
COMMENT ON FUNCTION public.cleanup_expired_email_confirmation_capabilities(integer) IS
  'Deletes bounded batches of expired confirmation capabilities without deleting Auth users; service role only.';