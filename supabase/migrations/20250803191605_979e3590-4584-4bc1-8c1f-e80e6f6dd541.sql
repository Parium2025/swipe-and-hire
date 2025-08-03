-- Add new role values to existing enum
ALTER TYPE public.user_role ADD VALUE 'super_admin' BEFORE 'job_seeker';
ALTER TYPE public.user_role ADD VALUE 'company_admin' BEFORE 'job_seeker'; 
ALTER TYPE public.user_role ADD VALUE 'recruiter' BEFORE 'job_seeker';

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

-- Update profiles table to add organization reference
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;