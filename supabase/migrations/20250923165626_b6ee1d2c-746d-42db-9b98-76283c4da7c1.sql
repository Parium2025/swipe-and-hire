-- Create job templates table for saving reusable job posting templates
CREATE TABLE public.job_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  location TEXT,
  employment_type TEXT,
  work_schedule TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  contact_email TEXT,
  application_instructions TEXT,
  category TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for job templates
CREATE POLICY "Employers can view their own templates" 
ON public.job_templates 
FOR SELECT 
USING (employer_id = auth.uid());

CREATE POLICY "Employers can create their own templates" 
ON public.job_templates 
FOR INSERT 
WITH CHECK (employer_id = auth.uid());

CREATE POLICY "Employers can update their own templates" 
ON public.job_templates 
FOR UPDATE 
USING (employer_id = auth.uid());

CREATE POLICY "Employers can delete their own templates" 
ON public.job_templates 
FOR DELETE 
USING (employer_id = auth.uid());

-- Super admins can manage all templates
CREATE POLICY "Super admins can manage all templates" 
ON public.job_templates 
FOR ALL 
USING (is_super_admin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_job_templates_updated_at
BEFORE UPDATE ON public.job_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_job_templates_employer_id ON public.job_templates(employer_id);
CREATE INDEX idx_job_templates_is_default ON public.job_templates(employer_id, is_default) WHERE is_default = true;