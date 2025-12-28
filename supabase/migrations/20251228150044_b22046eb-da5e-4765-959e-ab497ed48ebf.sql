-- Keep candidate activity log consistent when notes are deleted

-- 1) When a note is deleted, remove the corresponding note activities (for the whole team)
CREATE OR REPLACE FUNCTION public.handle_candidate_note_delete_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.candidate_activities ca
  WHERE ca.applicant_id = OLD.applicant_id
    AND ca.user_id = OLD.employer_id
    AND ca.activity_type IN ('note_added', 'note_edited')
    AND (
      -- Preferred linkage (we'll start writing note_id into metadata from the frontend)
      (ca.metadata->>'note_id' = OLD.id::text)
      -- Fallback for older rows that have no note_id metadata
      OR (ca.created_at BETWEEN (OLD.created_at - interval '120 seconds') AND (OLD.created_at + interval '120 seconds'))
      OR (ca.created_at BETWEEN (OLD.updated_at - interval '120 seconds') AND (OLD.updated_at + interval '120 seconds'))
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS candidate_notes_delete_cleanup ON public.candidate_notes;
CREATE TRIGGER candidate_notes_delete_cleanup
AFTER DELETE ON public.candidate_notes
FOR EACH ROW
EXECUTE FUNCTION public.handle_candidate_note_delete_cleanup();

-- 2) One-time cleanup: remove orphaned "note_added" activities where the note row no longer exists
DELETE FROM public.candidate_activities ca
WHERE ca.activity_type = 'note_added'
  AND NOT EXISTS (
    SELECT 1
    FROM public.candidate_notes cn
    WHERE cn.applicant_id = ca.applicant_id
      AND cn.employer_id = ca.user_id
      AND cn.created_at BETWEEN (ca.created_at - interval '120 seconds') AND (ca.created_at + interval '120 seconds')
  );