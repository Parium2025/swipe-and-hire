-- BLOCKED CONTRACT MIGRATION — intentionally outside supabase/migrations.
--
-- DO NOT MOVE this file into the auto-applied migrations directory until the
-- new CAS frontend has been verified in staging and adopted by the supported
-- production client population. Moving it early would break legacy clients
-- that still write jobseeker_notes directly.
--
-- Promotion procedure:
--   1. Fill every NULL evidence value in the fail-closed preflight below.
--   2. Have the named approver validate the underlying telemetry evidence.
--   3. Move this file to supabase/migrations using a new, unused timestamp.
--   4. Apply in staging first and verify save, conflict and recovery flows.
--
-- RLS continues to protect reads and Realtime visibility. Once promoted,
-- mutation privileges are removed so direct writes cannot bypass CAS.

DO $contract_preflight$
DECLARE
  -- These values deliberately default to NULL. Promotion must fail until an
  -- operator replaces every value with evidence from the production rollout.
  v_min_frontend_build text := NULL;
  v_min_frontend_commit text := NULL;
  v_observation_started_at timestamptz := NULL;
  v_observation_ended_at timestamptz := NULL;
  v_verified_cas_writes bigint := NULL;
  v_total_supported_writes bigint := NULL;
  v_supported_legacy_direct_writers bigint := NULL;
  v_approved_by text := NULL;
BEGIN
  IF v_min_frontend_build IS NULL OR btrim(v_min_frontend_build) = '' THEN
    RAISE EXCEPTION 'Contract migration blocked: minimum frontend build is required';
  END IF;

  IF v_min_frontend_commit IS NULL
     OR v_min_frontend_commit !~ '^[0-9a-fA-F]{7,40}$' THEN
    RAISE EXCEPTION 'Contract migration blocked: minimum frontend commit must be a 7-40 character Git SHA';
  END IF;

  IF v_observation_started_at IS NULL OR v_observation_ended_at IS NULL THEN
    RAISE EXCEPTION 'Contract migration blocked: observation timestamps are required';
  END IF;

  IF v_observation_ended_at > clock_timestamp()
     OR v_observation_ended_at - v_observation_started_at < interval '7 days'
     OR clock_timestamp() - v_observation_ended_at > interval '24 hours' THEN
    RAISE EXCEPTION 'Contract migration blocked: at least 7 completed observation days ending within the last 24 hours are required';
  END IF;

  IF v_verified_cas_writes IS NULL
     OR v_total_supported_writes IS NULL
     OR v_verified_cas_writes < 0
     OR v_total_supported_writes <= 0
     OR v_verified_cas_writes > v_total_supported_writes THEN
    RAISE EXCEPTION 'Contract migration blocked: valid CAS write counters are required';
  END IF;

  IF v_verified_cas_writes::numeric
       / NULLIF(v_total_supported_writes, 0) < 0.999 THEN
    RAISE EXCEPTION 'Contract migration blocked: verified CAS writes must be at least 99.9 percent';
  END IF;

  IF v_supported_legacy_direct_writers IS NULL
     OR v_supported_legacy_direct_writers <> 0 THEN
    RAISE EXCEPTION 'Contract migration blocked: supported legacy direct writers must equal zero';
  END IF;

  IF v_approved_by IS NULL
     OR v_approved_by !~ '^[^<>]{2,}\s+<[^<>@\s]+@[^<>@\s]+>$' THEN
    RAISE EXCEPTION 'Contract migration blocked: named approver and email are required';
  END IF;
END;
$contract_preflight$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.jobseeker_notes
  FROM anon, authenticated;

-- ROLLBACK SQL (run as a database owner if supported legacy clients must be
-- restored while the frontend rollout is corrected):
-- GRANT INSERT, UPDATE, DELETE ON TABLE public.jobseeker_notes TO authenticated;
