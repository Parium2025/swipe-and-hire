DELETE FROM public.my_candidates m
USING public.my_candidates n
WHERE m.recruiter_id = n.recruiter_id
  AND m.applicant_id = n.applicant_id
  AND (m.updated_at < n.updated_at OR (m.updated_at = n.updated_at AND m.id < n.id));

CREATE UNIQUE INDEX IF NOT EXISTS my_candidates_recruiter_applicant_key
  ON public.my_candidates (recruiter_id, applicant_id);