-- Restrict candidate_activities SELECT: only author or same-org as author
DROP POLICY IF EXISTS "Employers can view candidate activities" ON public.candidate_activities;
CREATE POLICY "Employers can view own candidate activities"
ON public.candidate_activities
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.same_organization(auth.uid(), user_id)
);

-- Restrict candidate_notes SELECT: only author or same-org (remove cross-employer shared-applicant leak)
DROP POLICY IF EXISTS "Employers can view notes for candidates they have access to" ON public.candidate_notes;
CREATE POLICY "Employers can view own or org candidate notes"
ON public.candidate_notes
FOR SELECT
USING (
  auth.uid() = employer_id
  OR public.same_organization(auth.uid(), employer_id)
);