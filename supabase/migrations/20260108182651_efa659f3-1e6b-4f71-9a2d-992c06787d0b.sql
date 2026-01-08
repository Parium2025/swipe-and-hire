-- Create interviews table for booking meetings with candidates
CREATE TABLE public.interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL,
  application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location_type TEXT NOT NULL DEFAULT 'video',
  location_details TEXT,
  subject TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add constraint for valid status values
ALTER TABLE public.interviews 
ADD CONSTRAINT interviews_status_check 
CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'completed'));

-- Add constraint for valid location types
ALTER TABLE public.interviews 
ADD CONSTRAINT interviews_location_type_check 
CHECK (location_type IN ('office', 'video', 'phone'));

-- Enable Row Level Security
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Employers can create interviews for candidates who applied to their jobs
CREATE POLICY "Employers can create interviews"
ON public.interviews
FOR INSERT
WITH CHECK (
  auth.uid() = employer_id 
  AND can_view_job_application(job_id)
);

-- Employers can view their own interviews
CREATE POLICY "Employers can view their interviews"
ON public.interviews
FOR SELECT
USING (auth.uid() = employer_id);

-- Employers can update their own interviews
CREATE POLICY "Employers can update their interviews"
ON public.interviews
FOR UPDATE
USING (auth.uid() = employer_id);

-- Employers can delete their own interviews
CREATE POLICY "Employers can delete their interviews"
ON public.interviews
FOR DELETE
USING (auth.uid() = employer_id);

-- Candidates can view interviews they're invited to
CREATE POLICY "Candidates can view their interview invites"
ON public.interviews
FOR SELECT
USING (auth.uid() = applicant_id);

-- Candidates can update status (accept/decline) on their interviews
CREATE POLICY "Candidates can respond to interviews"
ON public.interviews
FOR UPDATE
USING (auth.uid() = applicant_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_interviews_updated_at
BEFORE UPDATE ON public.interviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_interviews_employer_id ON public.interviews(employer_id);
CREATE INDEX idx_interviews_applicant_id ON public.interviews(applicant_id);
CREATE INDEX idx_interviews_scheduled_at ON public.interviews(scheduled_at);