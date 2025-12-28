-- Create a function to delete all note activities for an applicant
-- This runs with security definer so it can delete activities created by other users
CREATE OR REPLACE FUNCTION public.delete_note_activities_for_applicant(p_applicant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify the caller has access to this applicant's data
  IF NOT EXISTS (
    SELECT 1
    FROM job_applications ja
    JOIN job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = p_applicant_id
      AND can_view_job_application(ja.job_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Delete all note-related activities for this applicant
  DELETE FROM candidate_activities
  WHERE applicant_id = p_applicant_id
    AND activity_type IN ('note_added', 'note_edited');
END;
$$;