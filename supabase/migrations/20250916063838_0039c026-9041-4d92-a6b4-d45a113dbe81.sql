-- Create user data consent table for GDPR compliance
CREATE TABLE public.user_data_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  consent_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  data_types_consented JSONB DEFAULT '["age", "postal_code", "phone", "email", "location"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on the consent table
ALTER TABLE public.user_data_consents ENABLE ROW LEVEL SECURITY;

-- Users can only view and manage their own consent
CREATE POLICY "Users can view their own consent" 
ON public.user_data_consents 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent" 
ON public.user_data_consents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consent" 
ON public.user_data_consents 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Super admins can view all consents for compliance purposes
CREATE POLICY "Super admins can view all consents" 
ON public.user_data_consents 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Function to check if user has given consent
CREATE OR REPLACE FUNCTION public.user_has_given_consent(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT consent_given FROM public.user_data_consents WHERE user_id = user_uuid),
    false
  );
$$;

-- Update the profile access function to require consent
CREATE OR REPLACE FUNCTION public.get_consented_profile_for_employer(job_seeker_uuid uuid)
RETURNS TABLE(id uuid, user_id uuid, role user_role, created_at timestamp with time zone, updated_at timestamp with time zone, onboarding_completed boolean, interests jsonb, cv_url text, employment_status text, working_hours text, availability text, home_location text, first_name text, age integer, profile_image_url text, video_url text, phone text, postal_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  employer_role text;
  permission_valid boolean := false;
  user_consented boolean := false;
BEGIN
  -- Get employer role
  SELECT get_user_role(auth.uid()) INTO employer_role;
  
  -- Check if user has employer permissions
  IF employer_role NOT IN ('employer', 'recruiter', 'company_admin') THEN
    -- Log unauthorized access attempt
    PERFORM log_profile_access_attempt(job_seeker_uuid, auth.uid(), false);
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;
  
  -- Check if permission exists and is valid
  SELECT 
    CASE 
      WHEN pvp.expires_at IS NULL THEN true
      WHEN pvp.expires_at > now() THEN true
      ELSE false
    END
  INTO permission_valid
  FROM profile_view_permissions pvp
  WHERE pvp.job_seeker_id = job_seeker_uuid
    AND pvp.employer_id = auth.uid()
    AND pvp.is_active = true;
  
  -- If no valid permission found, deny access
  IF NOT permission_valid OR permission_valid IS NULL THEN
    -- Log access denial
    PERFORM log_profile_access_attempt(job_seeker_uuid, auth.uid(), false);
    RAISE EXCEPTION 'Access denied: no valid permission to view this profile';
  END IF;
  
  -- Check if user has given consent to share their data
  SELECT user_has_given_consent(job_seeker_uuid) INTO user_consented;
  
  IF NOT user_consented THEN
    -- Log consent denial
    PERFORM log_profile_access_attempt(job_seeker_uuid, auth.uid(), false);
    RAISE EXCEPTION 'Access denied: user has not consented to data sharing';
  END IF;
  
  -- Log successful access
  PERFORM log_profile_access_attempt(job_seeker_uuid, auth.uid(), true);
  
  -- Return consented profile data with age instead of birth_date
  RETURN QUERY 
  SELECT 
    p.id,
    p.user_id,
    p.role,
    p.created_at,
    p.updated_at,
    p.onboarding_completed,
    p.interests,
    p.cv_url,
    p.employment_status,
    p.working_hours,
    p.availability,
    -- Return city/municipality from location
    CASE 
      WHEN p.home_location IS NOT NULL THEN 
        split_part(p.home_location, ',', 1)
      ELSE p.location
    END as home_location,
    p.first_name,
    -- Calculate age from birth_date instead of returning birth_date
    CASE 
      WHEN p.birth_date IS NOT NULL THEN calculate_age(p.birth_date)
      ELSE NULL
    END as age,
    p.profile_image_url,
    p.video_url,
    -- Now include phone and postal_code with consent
    p.phone,
    p.postal_code
  FROM profiles p
  WHERE p.user_id = job_seeker_uuid 
    AND p.role = 'job_seeker';
END;
$$;

-- Add trigger to update updated_at timestamp on user_data_consents
CREATE TRIGGER update_user_data_consents_updated_at
BEFORE UPDATE ON public.user_data_consents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();