CREATE TABLE IF NOT EXISTS public.app_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  message text NOT NULL,
  route text NOT NULL DEFAULT '/',
  source text,
  stacktrace text,
  http_status integer,
  fingerprint text NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_exceptions_severity_check CHECK (severity IN ('warning', 'critical')),
  CONSTRAINT app_exceptions_occurrence_count_check CHECK (occurrence_count > 0)
);

ALTER TABLE public.app_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own app exceptions" ON public.app_exceptions;
CREATE POLICY "Users can view their own app exceptions"
ON public.app_exceptions
FOR SELECT
TO authenticated
USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can create their own app exceptions" ON public.app_exceptions;
CREATE POLICY "Users can create their own app exceptions"
ON public.app_exceptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can update their own app exceptions" ON public.app_exceptions;
CREATE POLICY "Users can update their own app exceptions"
ON public.app_exceptions
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_exceptions_owner_fingerprint
ON public.app_exceptions (owner_user_id, fingerprint);

CREATE INDEX IF NOT EXISTS idx_app_exceptions_owner_last_seen
ON public.app_exceptions (owner_user_id, last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.touch_app_exceptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_app_exceptions_updated_at ON public.app_exceptions;
CREATE TRIGGER trg_touch_app_exceptions_updated_at
BEFORE UPDATE ON public.app_exceptions
FOR EACH ROW
EXECUTE FUNCTION public.touch_app_exceptions_updated_at();