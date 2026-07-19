
-- Server-side enforcement of the free-tier application quota.
-- Prevents bypassing the paywall by calling the API directly.
CREATE OR REPLACE FUNCTION public.enforce_application_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_premium boolean;
  v_used int;
  v_limit constant int := 3;
BEGIN
  -- Only enforce on user-initiated inserts. Service role bypasses (backfills, admin ops).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only enforce when the applicant is the caller (matches existing RLS).
  IF NEW.applicant_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  v_is_premium := public.has_premium(NEW.applicant_id);
  IF v_is_premium THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int
  INTO v_used
  FROM public.job_applications
  WHERE applicant_id = NEW.applicant_id
    AND applied_at > now() - interval '7 days';

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'application_quota_exceeded'
      USING HINT = 'Free tier is limited to 3 applications per 7 days. Upgrade to premium.',
            ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_application_quota ON public.job_applications;
CREATE TRIGGER trg_enforce_application_quota
BEFORE INSERT ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_application_quota();
