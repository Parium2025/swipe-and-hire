
-- Employer message templates (e.g. rejection messages, follow-ups)
CREATE TABLE public.employer_message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'rejection',
  title text NOT NULL,
  content text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.employer_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can view their own templates"
  ON public.employer_message_templates FOR SELECT
  USING (auth.uid() = employer_id);

CREATE POLICY "Employers can create templates"
  ON public.employer_message_templates FOR INSERT
  WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Employers can update their own templates"
  ON public.employer_message_templates FOR UPDATE
  USING (auth.uid() = employer_id);

CREATE POLICY "Employers can delete their own templates"
  ON public.employer_message_templates FOR DELETE
  USING (auth.uid() = employer_id);

CREATE TRIGGER update_employer_message_templates_updated_at
  BEFORE UPDATE ON public.employer_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employer_message_templates_employer ON public.employer_message_templates (employer_id, category);
