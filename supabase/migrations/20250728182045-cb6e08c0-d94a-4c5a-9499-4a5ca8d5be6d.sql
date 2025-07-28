-- Create table for job postings
CREATE TABLE public.job_postings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  location TEXT NOT NULL,
  salary_min INTEGER,
  salary_max INTEGER,
  employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary', 'internship')),
  work_schedule TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  views_count INTEGER NOT NULL DEFAULT 0,
  applications_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- Create policies for job postings
CREATE POLICY "Anyone can view active job postings" 
ON public.job_postings 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Employers can view all their job postings" 
ON public.job_postings 
FOR SELECT 
TO authenticated
USING (employer_id = auth.uid());

CREATE POLICY "Employers can insert their own job postings" 
ON public.job_postings 
FOR INSERT 
TO authenticated
WITH CHECK (employer_id = auth.uid());

CREATE POLICY "Employers can update their own job postings" 
ON public.job_postings 
FOR UPDATE 
TO authenticated
USING (employer_id = auth.uid());

CREATE POLICY "Employers can delete their own job postings" 
ON public.job_postings 
FOR DELETE 
TO authenticated
USING (employer_id = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_job_postings_updated_at
  BEFORE UPDATE ON public.job_postings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_job_postings_employer_id ON public.job_postings(employer_id);
CREATE INDEX idx_job_postings_location ON public.job_postings(location);
CREATE INDEX idx_job_postings_active ON public.job_postings(is_active);
CREATE INDEX idx_job_postings_created_at ON public.job_postings(created_at DESC);