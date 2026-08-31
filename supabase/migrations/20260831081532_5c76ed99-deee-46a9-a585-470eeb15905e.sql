-- Keep signup provisioning atomic, but reject missing/invalid consent metadata
-- and preserve unsubscribe/bounce suppression. Only account-deletion tombstones
-- may be cleared when the same address deliberately creates a new account.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  reason text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppressed_emails_email_unique UNIQUE (email),
  CONSTRAINT suppressed_emails_email_length CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT suppressed_emails_reason_length CHECK (char_length(reason) BETWEEN 1 AND 64)
);

-- IF NOT EXISTS does not reconcile an older live table. Add the exact-email
-- key required by the webhook's onConflict contract when it is absent. A
-- duplicate dataset must stop this expand migration for operator cleanup
-- instead of silently leaving suppression writes non-deterministic.
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.suppressed_emails'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[
        (
          SELECT attnum::smallint
          FROM pg_catalog.pg_attribute
          WHERE attrelid = 'public.suppressed_emails'::regclass
            AND attname = 'email'
            AND NOT attisdropped
        )
      ]::smallint[]
  ) THEN
    ALTER TABLE public.suppressed_emails
      ADD CONSTRAINT suppressed_emails_email_unique UNIQUE (email);
  END IF;
END
$block$;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.suppressed_emails FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.suppressed_emails TO service_role;

CREATE INDEX IF NOT EXISTS suppressed_emails_normalized_email_idx
  ON public.suppressed_emails (lower(email));

COMMENT ON TABLE public.suppressed_emails IS
  'Server-managed mail suppression; browser roles have no table privileges.';