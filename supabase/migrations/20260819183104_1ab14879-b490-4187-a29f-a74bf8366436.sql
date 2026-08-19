CREATE OR REPLACE FUNCTION public.enforce_job_posting_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_max integer;
  v_has_plan boolean := false;
  v_active_count integer;
BEGIN
  -- Endast när annonsen faktiskt blir/är publicerad
  IF COALESCE(NEW.is_active, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_active, false) IS TRUE
     AND OLD.employer_id = NEW.employer_id THEN
    RETURN NEW;
  END IF;

  -- Ägarkonto och plattformsadmin passerar alltid
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = NEW.employer_id;
  IF v_email = 'pariumab@hotmail.com' THEN
    RETURN NEW;
  END IF;

  SELECT true, sp.max_active_jobs
    INTO v_has_plan, v_max
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.tier = us.tier
  WHERE us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > now())
    AND (
      us.user_id = NEW.employer_id
      OR (us.organization_id IS NOT NULL
          AND us.organization_id = public.get_user_organization_id(NEW.employer_id))
    )
  ORDER BY sp.price_sek DESC
  LIMIT 1;

  IF NOT COALESCE(v_has_plan, false) THEN
    SELECT true, 1 INTO v_has_plan, v_max
    FROM public.one_time_purchases otp
    WHERE otp.user_id = NEW.employer_id
      AND otp.status = 'active'
      AND (otp.activated_at IS NULL OR otp.expires_at IS NULL OR otp.expires_at > now())
    LIMIT 1;
  END IF;

  IF NOT COALESCE(v_has_plan, false) THEN
    RAISE EXCEPTION 'Ingen aktiv plan: välj en plan innan du publicerar annonsen.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_max IS NOT NULL THEN
    SELECT count(*) INTO v_active_count
    FROM public.job_postings jp
    WHERE jp.employer_id = NEW.employer_id
      AND jp.is_active IS TRUE
      AND jp.deleted_at IS NULL
      AND (jp.expires_at IS NULL OR jp.expires_at > now())
      AND jp.id <> NEW.id;

    IF v_active_count >= v_max THEN
      RAISE EXCEPTION 'Planens gräns på % aktiva annonser är nådd.', v_max
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_job_posting_plan ON public.job_postings;
CREATE TRIGGER trg_enforce_job_posting_plan
BEFORE INSERT OR UPDATE ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.enforce_job_posting_plan();