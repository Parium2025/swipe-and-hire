CREATE OR REPLACE FUNCTION public.company_owner_id(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT r.user_id
    FROM public.profiles me
    JOIN public.user_roles r ON r.organization_id = me.organization_id
     AND r.role = 'admin' AND COALESCE(r.is_active, true)
    JOIN public.profiles ap ON ap.user_id = r.user_id
    WHERE me.user_id = _uid AND me.organization_id IS NOT NULL
    ORDER BY COALESCE(ap.joined_via_invite, false), r.created_at, r.user_id
    LIMIT 1
  ), _uid);
$$;
REVOKE ALL ON FUNCTION public.company_owner_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_owner_id(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_company_owner_ids(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, owner_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u, public.company_owner_id(u) FROM unnest(p_user_ids[1:500]) AS u;
$$;
REVOKE ALL ON FUNCTION public.resolve_company_owner_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_owner_ids(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_company_review_stats(p_company_id uuid)
RETURNS TABLE(total_count bigint, avg_rating numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::bigint, avg(rating)::numeric
  FROM public.company_reviews
  WHERE company_id = public.company_owner_id(p_company_id);
$$;

CREATE OR REPLACE FUNCTION public.get_company_review_stats_batch(p_company_ids uuid[])
RETURNS TABLE(company_id uuid, total_count bigint, avg_rating numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ids AS (SELECT u AS requested, public.company_owner_id(u) AS owner FROM unnest(p_company_ids) AS u)
  SELECT ids.requested, count(r.id)::bigint, avg(r.rating)::numeric
  FROM ids JOIN public.company_reviews r ON r.company_id = ids.owner
  GROUP BY ids.requested;
$$;

CREATE OR REPLACE FUNCTION public.normalize_company_review_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.company_id := public.company_owner_id(NEW.company_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_normalize_company_review_owner ON public.company_reviews;
CREATE TRIGGER trg_normalize_company_review_owner
BEFORE INSERT OR UPDATE OF company_id ON public.company_reviews
FOR EACH ROW EXECUTE FUNCTION public.normalize_company_review_owner();

-- Namnbyte i profilen: trimma så annonser aldrig får mellanslag kvar.
CREATE OR REPLACE FUNCTION public.sync_jobs_branding_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (btrim(COALESCE(NEW.company_name,'')) IS DISTINCT FROM btrim(COALESCE(OLD.company_name,'')))
     OR (NEW.company_logo_url IS DISTINCT FROM OLD.company_logo_url) THEN
    UPDATE public.job_postings
    SET workplace_name = COALESCE(NULLIF(btrim(NEW.company_name), ''), workplace_name),
        company_logo_url = NEW.company_logo_url,
        updated_at = now()
    WHERE employer_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Rekryterare kan inte ändra bolagsuppgifter direkt; de följer alltid admin.
CREATE OR REPLACE FUNCTION public.lock_member_company_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR auth.uid() IS NULL OR auth.uid() <> NEW.user_id
     OR OLD.organization_id IS NULL
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.joined_via_invite IS DISTINCT FROM OLD.joined_via_invite
     OR public.is_org_admin(NEW.user_id, OLD.organization_id) THEN
    RETURN NEW;
  END IF;
  NEW.company_name := OLD.company_name;
  NEW.company_logo_url := OLD.company_logo_url;
  NEW.company_logo_original_url := OLD.company_logo_original_url;
  NEW.industry := OLD.industry;
  NEW.employee_count := OLD.employee_count;
  NEW.address := OLD.address;
  NEW.website := OLD.website;
  NEW.company_description := OLD.company_description;
  NEW.social_media_links := OLD.social_media_links;
  NEW.org_number := OLD.org_number;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS aa_lock_member_company_fields ON public.profiles;
CREATE TRIGGER aa_lock_member_company_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.lock_member_company_fields();

UPDATE public.company_reviews SET company_id = public.company_owner_id(company_id)
WHERE company_id IS DISTINCT FROM public.company_owner_id(company_id);