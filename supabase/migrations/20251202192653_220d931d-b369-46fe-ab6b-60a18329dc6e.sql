-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create new secure SELECT policy:
-- 1. Users can always view their OWN profile
-- 2. Everyone can view EMPLOYER profiles (public business info)
-- This protects job seeker personal data while allowing job listings to show company names
CREATE POLICY "Users can view own profile and employer profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id  -- Own profile
  OR role = 'employer'   -- Employer profiles are public (business info)
);