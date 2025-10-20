-- Allow public read access to employer company names and logos for job listings
CREATE POLICY "Public can view employer company info for job listings"
ON public.profiles
FOR SELECT
USING (
  role IN ('employer', 'company_admin', 'recruiter')
);
