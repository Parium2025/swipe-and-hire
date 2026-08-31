-- Lock down the legacy confirmation-token compatibility RPC during the
-- digest/CAS rollout. Current edge functions use the newer service-role-only
-- lookup/finalize RPCs, but an older deployment may still call this function.
-- Keep that compatibility without exposing a SECURITY DEFINER token oracle to
-- authenticated clients or persisting bearer capabilities in audit metadata.
CREATE OR REPLACE FUNCTION public.validate_confirmation_token(input_token uuid)
RETURNS TABLE (
  is_valid boolean,
  user_id uuid,
  email text,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF input_token IS NULL THEN
    RETURN QUERY
    SELECT false, NULL::uuid, NULL::text, NULL::timestamp with time zone;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true, ec.user_id, pg_catalog.to_jsonb(ec) ->> 'email', ec.expires_at
  FROM public.email_confirmations AS ec
  WHERE ec.token::text = input_token::text
    AND ec.expires_at > statement_timestamp()
    AND ec.confirmed_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, NULL::uuid, NULL::text, NULL::timestamp with time zone;
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.validate_confirmation_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_confirmation_token(uuid) TO service_role;

-- Historical versions stored both valid bearer tokens and arbitrary guesses
-- in the JSON audit metadata. Remove only that sensitive field while keeping
-- the action, actor and timestamps for operational traceability.
UPDATE public.security_audit_log
SET metadata = COALESCE(metadata, '{}'::jsonb) - 'token'
WHERE action IN ('token_validation_success', 'token_validation_failed')
  AND COALESCE(metadata, '{}'::jsonb) ? 'token';

COMMENT ON FUNCTION public.validate_confirmation_token(uuid) IS
  'Legacy service-role-only confirmation lookup retained for rolling deploy compatibility; never logs raw capabilities.';
