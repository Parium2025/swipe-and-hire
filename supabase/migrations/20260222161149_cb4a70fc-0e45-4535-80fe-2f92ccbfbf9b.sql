CREATE POLICY "Anyone can view employer basic profile info"
ON public.profiles
FOR SELECT
USING (role = 'employer'::user_role);