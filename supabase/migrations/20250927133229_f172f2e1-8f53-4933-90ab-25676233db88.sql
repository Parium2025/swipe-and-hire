-- Create table for job applications with automatic profile data population
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  
  -- Automatically populated from profile
  first_name TEXT,
  last_name TEXT,
  age INTEGER,
  email TEXT,
  phone TEXT,
  location TEXT,
  bio TEXT,
  cv_url TEXT,
  employment_status TEXT,
  availability TEXT,
  
  -- Custom question answers
  custom_answers JSONB DEFAULT '{}',
  
  -- Application status
  status TEXT DEFAULT 'pending',
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_postings(id) ON DELETE CASCADE,
  CONSTRAINT job_applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Create policies for job applications
CREATE POLICY "Applicants can view their own applications" 
ON public.job_applications 
FOR SELECT 
USING (applicant_id = auth.uid());

CREATE POLICY "Applicants can create their own applications" 
ON public.job_applications 
FOR INSERT 
WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "Employers can view applications for their jobs" 
ON public.job_applications 
FOR SELECT 
USING (EXISTS(
  SELECT 1 FROM public.job_postings jp 
  WHERE jp.id = job_applications.job_id 
  AND jp.employer_id = auth.uid()
));

CREATE POLICY "Employers can update applications for their jobs" 
ON public.job_applications 
FOR UPDATE 
USING (EXISTS(
  SELECT 1 FROM public.job_postings jp 
  WHERE jp.id = job_applications.job_id 
  AND jp.employer_id = auth.uid()
));

-- Create function to automatically populate application with profile data
CREATE OR REPLACE FUNCTION public.populate_application_from_profile()
RETURNS TRIGGER AS $$
DECLARE
  profile_data RECORD;
BEGIN
  -- Get profile data for the applicant
  SELECT 
    p.first_name,
    p.last_name,
    calculate_age(p.birth_date) as age,
    au.email,
    p.phone,
    COALESCE(p.home_location, p.location) as location,
    p.bio,
    p.cv_url,
    p.employment_status,
    p.availability
  INTO profile_data
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.user_id
  WHERE p.user_id = NEW.applicant_id;
  
  -- Auto-populate fields if not already set
  NEW.first_name := COALESCE(NEW.first_name, profile_data.first_name);
  NEW.last_name := COALESCE(NEW.last_name, profile_data.last_name);
  NEW.age := COALESCE(NEW.age, profile_data.age);
  NEW.email := COALESCE(NEW.email, profile_data.email);
  NEW.phone := COALESCE(NEW.phone, profile_data.phone);
  NEW.location := COALESCE(NEW.location, profile_data.location);
  NEW.bio := COALESCE(NEW.bio, profile_data.bio);
  NEW.cv_url := COALESCE(NEW.cv_url, profile_data.cv_url);
  NEW.employment_status := COALESCE(NEW.employment_status, profile_data.employment_status);
  NEW.availability := COALESCE(NEW.availability, profile_data.availability);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic profile data population
CREATE TRIGGER populate_application_profile_data
  BEFORE INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_application_from_profile();

-- Create function to update timestamps
CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();