INSERT INTO public.cv_analysis_queue (applicant_id, cv_url, priority, status)
SELECT p.id, p.cv_url, 10, 'pending'
FROM public.profiles p
WHERE p.id = 'd6041c11-192c-4a7f-8653-ec5878f79749'
  AND p.cv_url IS NOT NULL;