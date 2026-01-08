-- Create table for employer personal notes/reminders
CREATE TABLE public.employer_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.employer_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies - employers can only access their own notes
CREATE POLICY "Employers can view their own notes"
  ON public.employer_notes
  FOR SELECT
  USING (auth.uid() = employer_id);

CREATE POLICY "Employers can create their own notes"
  ON public.employer_notes
  FOR INSERT
  WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Employers can update their own notes"
  ON public.employer_notes
  FOR UPDATE
  USING (auth.uid() = employer_id);

CREATE POLICY "Employers can delete their own notes"
  ON public.employer_notes
  FOR DELETE
  USING (auth.uid() = employer_id);

-- Trigger for updated_at
CREATE TRIGGER update_employer_notes_updated_at
  BEFORE UPDATE ON public.employer_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();