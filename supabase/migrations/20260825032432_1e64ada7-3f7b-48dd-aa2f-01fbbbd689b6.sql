-- Gemensam definition: räkna externa (icke-interna) ansökningar för en annons.
CREATE OR REPLACE FUNCTION public.count_external_applications(p_job_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH j AS (
    SELECT jp.id, jp.employer_id FROM public.job_postings jp WHERE jp.id = p_job_id
  ),
  org AS (
    SELECT public.get_user_organization_id((SELECT employer_id FROM j)) AS org_id
  ),
  internal AS (
    SELECT ur.user_id FROM public.user_roles ur, org
    WHERE org.org_id IS NOT NULL AND ur.organization_id = org.org_id AND ur.is_active = true
    UNION
    SELECT employer_id FROM j
  )
  SELECT COUNT(*)::int
  FROM public.job_applications ja
  WHERE ja.job_id = p_job_id
    AND ja.applicant_id NOT IN (SELECT user_id FROM internal);
$$;

REVOKE EXECUTE ON FUNCTION public.count_external_applications(uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_job_applications_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.job_postings
  SET applications_count = public.count_external_applications(NEW.job_id)
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_job_applications_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.job_postings
  SET applications_count = public.count_external_applications(OLD.job_id)
  WHERE id = OLD.job_id;
  RETURN OLD;
END;
$$;

-- Engångs-omräkning så befintliga siffror matchar statistiksidan.
UPDATE public.job_postings jp
SET applications_count = public.count_external_applications(jp.id)
WHERE jp.deleted_at IS NULL;