-- Add final missing columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS max_recruiters INTEGER DEFAULT 5;
ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS job_image_url TEXT;

-- Create support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tickets"
ON public.support_tickets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
ON public.support_tickets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create function to get consented profile for employer
CREATE OR REPLACE FUNCTION public.get_consented_profile_for_employer(
  p_employer_id UUID,
  p_profile_id UUID
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  profile_image_url TEXT,
  video_url TEXT,
  cv_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if employer has permission to view this profile
  -- Either through job application or explicit permission
  IF EXISTS (
    SELECT 1 FROM job_applications ja
    WHERE ja.applicant_id = p_profile_id
    AND ja.job_id IN (
      SELECT id FROM job_postings WHERE employer_id = p_employer_id
    )
  ) OR EXISTS (
    SELECT 1 FROM profile_view_permissions pvp
    WHERE pvp.profile_id = p_profile_id
    AND pvp.viewer_id = p_employer_id
    AND (pvp.expires_at IS NULL OR pvp.expires_at > NOW())
  ) THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.user_id,
      p.first_name,
      p.last_name,
      p.email,
      p.phone,
      p.profile_image_url,
      p.video_url,
      p.cv_url
    FROM profiles p
    WHERE p.user_id = p_profile_id;
  ELSE
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT WHERE FALSE;
  END IF;
END;
$$;