ALTER TABLE public.job_postings
  ADD CONSTRAINT job_postings_title_length_check
  CHECK (char_length(title) <= 160) NOT VALID;

ALTER TABLE public.job_templates
  ADD CONSTRAINT job_templates_title_length_check
  CHECK (char_length(title) <= 160) NOT VALID;

ALTER TABLE public.job_templates
  ADD CONSTRAINT job_templates_name_length_check
  CHECK (char_length(name) <= 100) NOT VALID;