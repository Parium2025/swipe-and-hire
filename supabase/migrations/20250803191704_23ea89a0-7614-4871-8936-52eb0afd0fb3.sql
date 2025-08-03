-- Fix security definer functions with proper search_path
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID, org_uuid UUID DEFAULT NULL)
RETURNS TEXT 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = ''
AS $$
  SELECT role::TEXT 
  FROM public.user_roles 
  WHERE user_id = user_uuid 
    AND is_active = true
    AND (org_uuid IS NULL OR organization_id = org_uuid)
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1
      WHEN 'company_admin' THEN 2  
      WHEN 'recruiter' THEN 3
      WHEN 'job_seeker' THEN 4
      WHEN 'employer' THEN 5
    END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid 
      AND role = 'super_admin' 
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization(user_uuid UUID)
RETURNS UUID 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = ''
AS $$
  SELECT organization_id 
  FROM public.user_roles 
  WHERE user_id = user_uuid 
    AND is_active = true
    AND organization_id IS NOT NULL
  LIMIT 1;
$$;

-- Add your super admin role (if email exists)
INSERT INTO public.user_roles (user_id, role, is_active)
SELECT id, 'super_admin', true
FROM auth.users 
WHERE email = 'fredrikandits@hotmail.com'
ON CONFLICT (user_id, organization_id, role) DO NOTHING;