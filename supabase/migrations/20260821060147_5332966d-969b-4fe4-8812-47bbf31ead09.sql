-- 1) job_applications: WITH CHECK + kolumnskydd
DROP POLICY IF EXISTS "Employers can update applications to org jobs" ON public.job_applications;
CREATE POLICY "Employers can update applications to org jobs"
ON public.job_applications
FOR UPDATE
TO authenticated
USING (public.can_view_job_application(job_id))
WITH CHECK (public.can_view_job_application(job_id));

CREATE OR REPLACE FUNCTION public.guard_job_application_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sökanden själv (och service_role/backend) får ändra allt via sina egna policys.
  IF auth.uid() IS NULL OR auth.uid() = OLD.applicant_id THEN
    RETURN NEW;
  END IF;

  -- Arbetsgivare får endast ändra status och viewed_at.
  NEW.job_id                     := OLD.job_id;
  NEW.applicant_id               := OLD.applicant_id;
  NEW.cover_letter               := OLD.cover_letter;
  NEW.first_name                 := OLD.first_name;
  NEW.last_name                  := OLD.last_name;
  NEW.email                      := OLD.email;
  NEW.phone                      := OLD.phone;
  NEW.age                        := OLD.age;
  NEW.location                   := OLD.location;
  NEW.bio                        := OLD.bio;
  NEW.cv_url                     := OLD.cv_url;
  NEW.custom_answers             := OLD.custom_answers;
  NEW.applied_at                 := OLD.applied_at;
  NEW.created_at                 := OLD.created_at;
  NEW.employment_status          := OLD.employment_status;
  NEW.availability               := OLD.availability;
  NEW.work_schedule              := OLD.work_schedule;
  NEW.profile_image_snapshot_url := OLD.profile_image_snapshot_url;
  NEW.video_snapshot_url         := OLD.video_snapshot_url;
  NEW.questions_snapshot         := OLD.questions_snapshot;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_job_application_columns ON public.job_applications;
CREATE TRIGGER trg_guard_job_application_columns
BEFORE UPDATE ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.guard_job_application_columns();

-- 2) user_roles: org-admin får bara tilldela roller till befintliga medlemmar
DROP POLICY IF EXISTS "Admins can insert to user_roles" ON public.user_roles;
CREATE POLICY "Admins can insert to user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND public.is_org_admin(auth.uid(), organization_id)
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.organization_id = user_roles.organization_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = user_roles.user_id
        AND ur.organization_id = user_roles.organization_id
    )
  )
);