-- Smoke test: verifierar att en jobbsökare kan skicka in en ansökan hela vägen,
-- dvs att behörighetsreglerna (RLS) på job_applications + job_postings inte
-- hamnar i rundgång ("infinite recursion detected in policy").
--
-- Bakgrund: 2026-09 slutade alla ansökningar fungera eftersom regeln
-- "Applicants can view applied job postings" frågade job_applications,
-- medan job_applications-reglerna frågade job_postings. Fixen var att gå via
-- security definer-funktionen public.has_applied_to_job(uuid).
--
-- Körs som privilegierad session. Allt rullas tillbaka - inga rader blir kvar.

BEGIN;

-- 1) Statiskt skydd: ingen policy på job_postings får peka direkt på job_applications.
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(policyname, ', ')
    INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'job_postings'
    AND (coalesce(qual, '') ILIKE '%job_applications%'
      OR coalesce(with_check, '') ILIKE '%job_applications%');

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RECURSION RISK: job_postings-policy refererar job_applications direkt: %', bad;
  END IF;
END $$;

-- 2) Skarpt test: gör en riktig insert som en riktig jobbsökare, med RLS påslaget.
DO $$
DECLARE
  v_job uuid;
  v_user uuid;
  v_new uuid;
BEGIN
  SELECT jp.id INTO v_job
  FROM public.job_postings jp
  WHERE jp.is_active = true
    AND jp.deleted_at IS NULL
    AND (jp.expires_at IS NULL OR jp.expires_at > now())
  ORDER BY jp.created_at DESC
  LIMIT 1;

  SELECT p.user_id INTO v_user
  FROM public.profiles p
  WHERE p.role = 'job_seeker'
    AND NOT EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.job_id = v_job AND ja.applicant_id = p.user_id
    )
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_job IS NULL OR v_user IS NULL THEN
    RAISE NOTICE 'SKIPPED: hittade ingen aktiv annons eller ledig testanvändare';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  INSERT INTO public.job_applications (job_id, applicant_id)
  VALUES (v_job, v_user)
  RETURNING id INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'FAILED: ansökan kunde inte skapas';
  END IF;

  RESET ROLE;
  RAISE NOTICE 'OK: ansökan % skapades för job % (rullas tillbaka)', v_new, v_job;
END $$;

ROLLBACK;
