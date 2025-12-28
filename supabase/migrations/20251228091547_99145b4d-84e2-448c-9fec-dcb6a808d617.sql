-- Add a foreign key constraint for the join to work
ALTER TABLE public.candidate_notes 
ADD CONSTRAINT candidate_notes_employer_id_fkey 
FOREIGN KEY (employer_id) REFERENCES public.profiles(user_id);

-- Update RLS policy to allow viewing notes from same organization
DROP POLICY IF EXISTS "Employers can view their own notes" ON public.candidate_notes;

CREATE POLICY "Employers can view notes for candidates they have access to"
ON public.candidate_notes
FOR SELECT
USING (
  auth.uid() = employer_id
  OR same_organization(auth.uid(), employer_id)
  OR EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = candidate_notes.applicant_id
    AND jp.employer_id = auth.uid()
  )
);