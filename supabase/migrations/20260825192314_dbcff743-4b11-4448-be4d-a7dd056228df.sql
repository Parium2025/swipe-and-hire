UPDATE public.job_postings
SET title = left(regexp_replace(title, '\s+', ' ', 'g'), 157) || '...'
WHERE char_length(title) > 160;

ALTER TABLE public.job_postings VALIDATE CONSTRAINT job_postings_title_length_check;