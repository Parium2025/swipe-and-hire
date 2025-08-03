-- Create role enum for different user types
CREATE TYPE public.user_role AS ENUM (
  'super_admin',    -- Platform owner (fredrikandits@hotmail.com)
  'company_admin',  -- Company owner/admin
  'recruiter',      -- Company recruiter
  'job_seeker'      -- Job seekers
);

-- Create organizations table for companies
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  org_number TEXT UNIQUE, -- Swedish organization number
  website TEXT,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscription_plan TEXT DEFAULT 'basic', -- basic, premium, enterprise
  max_recruiters INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table to handle role assignments
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role user_role NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one active role per user per organization
  UNIQUE(user_id, organization_id, role)
);

-- Update profiles table to remove old role column and add organization reference
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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
  AND public.get_user_role(auth.uid()) IN ('company_admin', 'recruiter')
);

CREATE POLICY "Super admins can manage all job postings" 
ON public.job_postings FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert your super admin role
INSERT INTO public.user_roles (user_id, role, is_active)
SELECT id, 'super_admin', true
FROM auth.users 
WHERE email = 'fredrikandits@hotmail.com'
ON CONFLICT DO NOTHING;