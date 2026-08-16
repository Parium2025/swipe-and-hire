CREATE OR REPLACE FUNCTION public.same_organization(p_user_id_1 uuid, p_user_id_2 uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id_1
     AND auth.uid() <> p_user_id_2
    THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles ur1
      JOIN public.user_roles ur2 ON ur1.organization_id = ur2.organization_id
      WHERE ur1.user_id = p_user_id_1
        AND ur2.user_id = p_user_id_2
        AND ur1.is_active = true
        AND ur2.is_active = true
        AND ur1.organization_id IS NOT NULL
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.has_applied_to_employer(p_applicant_id uuid, p_employer_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL
     AND auth.uid() <> p_applicant_id
     AND auth.uid() <> p_employer_id
    THEN false
    ELSE EXISTS (
      SELECT 1 FROM job_applications ja
      JOIN job_postings jp ON ja.job_id = jp.id
      WHERE ja.applicant_id = p_applicant_id
      AND (
        jp.employer_id = p_employer_id
        OR EXISTS (
          SELECT 1
          FROM user_roles ur1
          JOIN user_roles ur2 ON ur1.organization_id = ur2.organization_id
          WHERE ur1.user_id = jp.employer_id
            AND ur2.user_id = p_employer_id
            AND ur1.is_active = true
            AND ur2.is_active = true
            AND ur1.organization_id IS NOT NULL
        )
      )
    )
  END
$function$;