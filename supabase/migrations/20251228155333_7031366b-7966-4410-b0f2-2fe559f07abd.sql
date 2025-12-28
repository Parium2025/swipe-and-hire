-- Update RLS policies for my_candidates to allow organization members to modify colleagues' candidates
-- They can ADD, MOVE (update stage), and REMOVE candidates from colleagues' lists

-- Policy for INSERT: Organization members can add candidates to colleagues' lists
CREATE POLICY "Organization members can add to colleagues candidates"
ON public.my_candidates
FOR INSERT
WITH CHECK (
  same_organization(auth.uid(), recruiter_id)
);

-- Policy for UPDATE: Organization members can update colleagues' candidates (move between stages)
CREATE POLICY "Organization members can update colleagues candidates"
ON public.my_candidates
FOR UPDATE
USING (
  same_organization(auth.uid(), recruiter_id)
);

-- Policy for DELETE: Organization members can remove colleagues' candidates
CREATE POLICY "Organization members can delete colleagues candidates"
ON public.my_candidates
FOR DELETE
USING (
  same_organization(auth.uid(), recruiter_id)
);