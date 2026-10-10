-- En ansökan innebär att annonsen har setts: registrera visningen på servern.
CREATE OR REPLACE FUNCTION public.record_view_on_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employer uuid;
  v_owner_org uuid;
  v_viewer_org uuid;
BEGIN
  SELECT employer_id INTO v_employer FROM job_postings WHERE id = NEW.job_id;
  IF v_employer IS NULL OR v_employer = NEW.applicant_id THEN
    RETURN NEW;
  END IF;
  v_owner_org := get_user_organization_id(v_employer);
  v_viewer_org := get_user_organization_id(NEW.applicant_id);
  IF v_owner_org IS NOT NULL AND v_owner_org = v_viewer_org THEN
    RETURN NEW;
  END IF;

  INSERT INTO job_views (job_id, user_id, device_type, os_type)
  VALUES (NEW.job_id, NEW.applicant_id, 'unknown', 'unknown')
  ON CONFLICT (job_id, user_id) DO NOTHING;
  IF FOUND THEN
    UPDATE job_postings SET views_count = COALESCE(views_count, 0) + 1 WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Visningen får aldrig stoppa en ansökan.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_view_on_application() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_record_view_on_application ON public.job_applications;
CREATE TRIGGER trg_record_view_on_application
AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.record_view_on_application();

-- Rätta befintliga ansökningar som saknar visning.
WITH missing AS (
  INSERT INTO job_views (job_id, user_id, device_type, os_type, created_at)
  SELECT ja.job_id, ja.applicant_id, 'unknown', 'unknown', ja.applied_at
  FROM job_applications ja
  JOIN job_postings jp ON jp.id = ja.job_id
  WHERE ja.applicant_id <> jp.employer_id
    AND NOT EXISTS (SELECT 1 FROM user_roles ur1 JOIN user_roles ur2 ON ur1.organization_id = ur2.organization_id
                    WHERE ur1.user_id = jp.employer_id AND ur2.user_id = ja.applicant_id AND ur1.organization_id IS NOT NULL)
  ON CONFLICT (job_id, user_id) DO NOTHING
  RETURNING job_id
)
UPDATE job_postings jp SET views_count = COALESCE(jp.views_count, 0) + m.c
FROM (SELECT job_id, count(*) c FROM missing GROUP BY job_id) m
WHERE jp.id = m.job_id;