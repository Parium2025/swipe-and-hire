CREATE OR REPLACE FUNCTION public.delete_note_activities_for_applicant(p_applicant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM job_applications ja
    WHERE ja.applicant_id = p_applicant_id
      AND can_view_job_application(ja.job_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Scope deletion to the caller's own organization/team only.
  DELETE FROM candidate_activities ca
  WHERE ca.applicant_id = p_applicant_id
    AND ca.activity_type IN ('note_added', 'note_edited')
    AND (ca.user_id = v_uid OR same_organization(v_uid, ca.user_id));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_note_activities_for_applicant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_note_activities_for_applicant(uuid) TO authenticated;