-- Create security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID, org_uuid UUID DEFAULT NULL)
RETURNS TEXT AS $$
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
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid 
      AND role = 'super_admin' 
      AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_organization(user_uuid UUID)
RETURNS UUID AS $$
  SELECT organization_id 
  FROM public.user_roles 
  WHERE user_id = user_uuid 
    AND is_active = true
    AND organization_id IS NOT NULL
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for organizations
CREATE POLICY "Super admins can view all organizations" 
ON public.organizations FOR SELECT 
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own organization" 
ON public.organizations FOR SELECT 
USING (id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super admins can manage all organizations" 
ON public.organizations FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- RLS Policies for user_roles
CREATE POLICY "Super admins can view all user roles" 
ON public.user_roles FOR SELECT 
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own roles" 
ON public.user_roles FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Company admins can view roles in their organization" 
ON public.user_roles FOR SELECT 
USING (
  organization_id = public.get_user_organization(auth.uid()) 
  AND public.get_user_role(auth.uid()) IN ('company_admin', 'recruiter')
);

CREATE POLICY "Super admins can manage all user roles" 
ON public.user_roles FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- Update job_postings table to include organization reference
ALTER TABLE public.job_postings ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Update job_postings RLS policies
DROP POLICY IF EXISTS "Employers can insert their own job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Employers can update their own job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Employers can delete their own job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Employers can view all their job postings" ON public.job_postings;

CREATE POLICY "Company users can manage their organization's job postings" 
ON public.job_postings FOR ALL 
USING (
  organization_id = public.get_user_organization(auth.uid()) 
  AND public.get_user_role(auth.uid()) IN ('company_admin', 'recruiter', 'employer')
);

CREATE POLICY "Super admins can manage all job postings" 
ON public.job_postings FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- Create trigger for updating timestamps
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();