CREATE OR REPLACE FUNCTION public.can_write_my_candidate(
  p_recruiter_id uuid,
  p_applicant_id uuid,
  p_application_id uuid,
  p_job_id uuid,
  p_list_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = p_recruiter_id
      OR public.same_organization(auth.uid(), p_recruiter_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.job_applications ja
      WHERE ja.id = p_application_id
        AND ja.applicant_id = p_applicant_id
        AND (p_job_id IS NULL OR p_job_id = ja.job_id)
        AND public.can_view_job_application(ja.job_id)
    )
    AND (
      p_list_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.candidate_lists cl
        WHERE cl.id = p_list_id
          AND cl.owner_id = p_recruiter_id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_write_my_candidate(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_my_candidate(uuid, uuid, uuid, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Recruiters can add candidates" ON public.my_candidates;
DROP POLICY IF EXISTS "Organization members can add to colleagues candidates" ON public.my_candidates;
DROP POLICY IF EXISTS "Recruiters can update their own candidates" ON public.my_candidates;
DROP POLICY IF EXISTS "Organization members can update colleagues candidates" ON public.my_candidates;

CREATE POLICY "Recruiters can add valid candidates"
ON public.my_candidates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = recruiter_id
  AND public.can_write_my_candidate(recruiter_id, applicant_id, application_id, job_id, list_id)
);

CREATE POLICY "Organization members can add valid colleague candidates"
ON public.my_candidates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() <> recruiter_id
  AND public.same_organization(auth.uid(), recruiter_id)
  AND public.can_write_my_candidate(recruiter_id, applicant_id, application_id, job_id, list_id)
);

CREATE POLICY "Recruiters can update their own valid candidates"
ON public.my_candidates
FOR UPDATE
TO authenticated
USING (auth.uid() = recruiter_id)
WITH CHECK (
  auth.uid() = recruiter_id
  AND public.can_write_my_candidate(recruiter_id, applicant_id, application_id, job_id, list_id)
);

CREATE POLICY "Organization members can update valid colleague candidates"
ON public.my_candidates
FOR UPDATE
TO authenticated
USING (auth.uid() <> recruiter_id AND public.same_organization(auth.uid(), recruiter_id))
WITH CHECK (
  auth.uid() <> recruiter_id
  AND public.same_organization(auth.uid(), recruiter_id)
  AND public.can_write_my_candidate(recruiter_id, applicant_id, application_id, job_id, list_id)
);