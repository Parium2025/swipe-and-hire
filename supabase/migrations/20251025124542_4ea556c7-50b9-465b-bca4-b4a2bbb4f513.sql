-- Fas 1: Migrera befintlig data för alla företag
-- 1.1: Skapa organizations för alla unika company_name i profiles
INSERT INTO public.organizations (name, org_number, website, description, created_at, updated_at)
SELECT DISTINCT 
  p.company_name,
  p.org_number,
  p.website,
  p.company_description,
  NOW(),
  NOW()
FROM public.profiles p
WHERE p.company_name IS NOT NULL 
  AND p.company_name != ''
  AND p.role IN ('employer', 'company_admin', 'recruiter')
  AND NOT EXISTS (
    SELECT 1 FROM public.organizations o 
    WHERE o.name = p.company_name
  );

-- 1.2: Uppdatera profiles med organization_id
UPDATE public.profiles p
SET organization_id = o.id, updated_at = NOW()
FROM public.organizations o
WHERE p.company_name = o.name
  AND p.organization_id IS NULL
  AND p.role IN ('employer', 'company_admin', 'recruiter');

-- 1.3: Uppdatera job_postings med organization_id från employer's profile
UPDATE public.job_postings jp
SET organization_id = p.organization_id, updated_at = NOW()
FROM public.profiles p
WHERE jp.employer_id = p.user_id
  AND jp.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

-- Fas 2: Uppdatera handle_new_user() för automatisk organization-skapning
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_role text;
  cast_role public.user_role;
  org_id uuid;
  existing_org_id uuid;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';

  -- Safe cast with default to job_seeker
  BEGIN
    cast_role := COALESCE(meta_role::public.user_role, 'job_seeker'::public.user_role);
  EXCEPTION WHEN others THEN
    cast_role := 'job_seeker'::public.user_role;
  END;

  -- If employer/company_admin/recruiter, handle organization
  IF cast_role IN ('employer', 'company_admin', 'recruiter') THEN
    -- Check if organization already exists
    SELECT id INTO existing_org_id
    FROM public.organizations
    WHERE name = NEW.raw_user_meta_data->>'company_name'
    LIMIT 1;

    IF existing_org_id IS NOT NULL THEN
      -- Use existing organization
      org_id := existing_org_id;
    ELSE
      -- Create new organization
      INSERT INTO public.organizations (
        name,
        org_number,
        website,
        description,
        created_at,
        updated_at
      ) VALUES (
        NEW.raw_user_meta_data->>'company_name',
        NEW.raw_user_meta_data->>'org_number',
        NEW.raw_user_meta_data->>'website',
        NEW.raw_user_meta_data->>'company_description',
        NOW(),
        NOW()
      )
      RETURNING id INTO org_id;
    END IF;
  END IF;

  -- Create profile with organization_id
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    phone,
    role,
    company_name,
    org_number,
    industry,
    address,
    website,
    company_description,
    employee_count,
    organization_id,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone',
    cast_role,
    NEW.raw_user_meta_data ->> 'company_name',
    NEW.raw_user_meta_data ->> 'org_number',
    NEW.raw_user_meta_data ->> 'industry',
    NEW.raw_user_meta_data ->> 'address',
    NEW.raw_user_meta_data ->> 'website',
    NEW.raw_user_meta_data ->> 'company_description',
    NEW.raw_user_meta_data ->> 'employee_count',
    org_id,
    NOW(),
    NOW()
  );

  -- Insert user role with organization_id
  IF meta_role IS NOT NULL AND meta_role <> '' THEN
    INSERT INTO public.user_roles (
      user_id,
      role,
      organization_id,
      is_active,
      created_at
    ) VALUES (
      NEW.id,
      cast_role,
      org_id,
      true,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Fas 3: Skapa trigger för automatisk organization_id på job_postings
CREATE OR REPLACE FUNCTION public.set_job_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Automatically set organization_id from employer's profile
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.profiles
    WHERE user_id = NEW.employer_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS set_job_organization_trigger ON public.job_postings;
CREATE TRIGGER set_job_organization_trigger
  BEFORE INSERT OR UPDATE ON public.job_postings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_job_organization();