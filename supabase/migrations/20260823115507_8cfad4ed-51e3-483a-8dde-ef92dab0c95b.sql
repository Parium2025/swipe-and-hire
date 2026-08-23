-- 1) Städa befintliga föräldralösa rader (om några)
DELETE FROM public.my_candidates mc
WHERE NOT EXISTS (SELECT 1 FROM public.job_applications ja WHERE ja.id = mc.application_id);

UPDATE public.my_candidates mc
SET job_id = NULL
WHERE mc.job_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.job_postings jp WHERE jp.id = mc.job_id);

-- 2) Riktiga kopplingar så att databasen städar automatiskt
ALTER TABLE public.my_candidates
  ADD CONSTRAINT my_candidates_application_id_fkey
  FOREIGN KEY (application_id) REFERENCES public.job_applications(id) ON DELETE CASCADE;

ALTER TABLE public.my_candidates
  ADD CONSTRAINT my_candidates_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES public.job_postings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_my_candidates_application_id ON public.my_candidates(application_id);
CREATE INDEX IF NOT EXISTS idx_my_candidates_job_id ON public.my_candidates(job_id);