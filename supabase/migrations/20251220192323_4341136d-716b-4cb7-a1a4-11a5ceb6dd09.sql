-- Create candidate_notes table for employer notes about candidates
CREATE TABLE public.candidate_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  job_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

-- Employers can view their own notes
CREATE POLICY "Employers can view their own notes"
ON public.candidate_notes
FOR SELECT
USING (auth.uid() = employer_id);

-- Employers can create notes
CREATE POLICY "Employers can create notes"
ON public.candidate_notes
FOR INSERT
WITH CHECK (auth.uid() = employer_id);

-- Employers can update their own notes
CREATE POLICY "Employers can update their own notes"
ON public.candidate_notes
FOR UPDATE
USING (auth.uid() = employer_id);

-- Employers can delete their own notes
CREATE POLICY "Employers can delete their own notes"
ON public.candidate_notes
FOR DELETE
USING (auth.uid() = employer_id);

-- Create trigger for updated_at
CREATE TRIGGER update_candidate_notes_updated_at
BEFORE UPDATE ON public.candidate_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_candidate_notes_employer_applicant ON public.candidate_notes(employer_id, applicant_id);
CREATE INDEX idx_candidate_notes_job ON public.candidate_notes(job_id);