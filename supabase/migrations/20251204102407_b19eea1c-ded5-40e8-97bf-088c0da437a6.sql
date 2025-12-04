-- 1. Create function to check if user is admin of their organization
CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
    AND role = 'admin'
    AND is_active = true
  )
$$;

-- 2. Create function to get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.user_roles
  WHERE user_id = p_user_id
  AND is_active = true
  LIMIT 1
$$;

-- 3. Update handle_new_user to create organization and assign admin role for employers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_org_id uuid;
  v_company_name text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'job_seeker');
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  
  -- Create profile
  INSERT INTO public.profiles (
    user_id, 
    role, 
    first_name, 
    last_name,
    company_name
  )
  VALUES (
    NEW.id,
    v_role::public.user_role,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    v_company_name
  );
  
  -- For employers: create organization and assign admin role
  IF v_role = 'employer' THEN
    -- Create organization
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(v_company_name, 'Min organisation'))
    RETURNING id INTO v_org_id;
    
    -- Assign admin role to the creator
    INSERT INTO public.user_roles (user_id, role, organization_id, is_active)
    VALUES (NEW.id, 'admin', v_org_id, true);
    
    -- Update profile with organization_id
    UPDATE public.profiles 
    SET organization_id = v_org_id 
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Add RLS policy for organizations to allow admins to manage their org
CREATE POLICY "Admins can update their organization"
ON public.organizations
FOR UPDATE
USING (public.is_org_admin(auth.uid()) AND id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can insert to user_roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  public.is_org_admin(auth.uid()) 
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "Admins can update user_roles in their org"
ON public.user_roles
FOR UPDATE
USING (
  public.is_org_admin(auth.uid()) 
  AND organization_id = public.get_user_organization_id(auth.uid())
);