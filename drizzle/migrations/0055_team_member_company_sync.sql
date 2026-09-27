ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS joined_via_invite boolean NOT NULL DEFAULT false;

-- Kopierar bolagets uppgifter från en admin i organisationen till en medlem.
CREATE OR REPLACE FUNCTION public.copy_org_company_fields_to_member(p_user_id uuid, p_organization_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src RECORD;
BEGIN
  SELECT p.company_name, p.company_logo_url, p.company_logo_original_url, p.industry, p.employee_count,
         p.address, p.website, p.company_description, p.social_media_links, p.org_number
    INTO src
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.user_id AND r.organization_id = p_organization_id
   AND r.role = 'admin' AND r.is_active = true
  WHERE p.user_id <> p_user_id AND p.joined_via_invite = false
  ORDER BY r.created_at ASC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.profiles SET
    company_name = src.company_name, company_logo_url = src.company_logo_url,
    company_logo_original_url = src.company_logo_original_url, industry = src.industry,
    employee_count = src.employee_count, address = src.address, website = src.website,
    company_description = src.company_description, social_media_links = src.social_media_links,
    org_number = src.org_number, joined_via_invite = true, organization_id = p_organization_id
  WHERE user_id = p_user_id;
END $$;
REVOKE ALL ON FUNCTION public.copy_org_company_fields_to_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_org_company_fields_to_member(uuid, uuid) TO service_role;

-- När en admin ändrar bolagets uppgifter speglas de till alla i organisationen.
CREATE OR REPLACE FUNCTION public.sync_company_fields_to_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.organization_id IS NULL THEN RETURN NEW; END IF;
  IF (NEW.company_name, NEW.company_logo_url, NEW.company_logo_original_url, NEW.industry, NEW.employee_count,
      NEW.address, NEW.website, NEW.company_description, NEW.social_media_links, NEW.org_number)
     IS NOT DISTINCT FROM
     (OLD.company_name, OLD.company_logo_url, OLD.company_logo_original_url, OLD.industry, OLD.employee_count,
      OLD.address, OLD.website, OLD.company_description, OLD.social_media_links, OLD.org_number) THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_org_admin(NEW.user_id, NEW.organization_id) THEN RETURN NEW; END IF;
  UPDATE public.profiles SET
    company_name = NEW.company_name, company_logo_url = NEW.company_logo_url,
    company_logo_original_url = NEW.company_logo_original_url, industry = NEW.industry,
    employee_count = NEW.employee_count, address = NEW.address, website = NEW.website,
    company_description = NEW.company_description, social_media_links = NEW.social_media_links,
    org_number = NEW.org_number
  WHERE organization_id = NEW.organization_id AND user_id <> NEW.user_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_company_fields_to_org() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_company_fields_to_org ON public.profiles;
CREATE TRIGGER trg_sync_company_fields_to_org AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_company_fields_to_org();