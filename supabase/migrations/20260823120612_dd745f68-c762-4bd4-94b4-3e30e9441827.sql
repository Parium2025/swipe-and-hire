ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS hidden_by_applicant_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_hidden
  ON public.job_applications (applicant_id, hidden_by_applicant_at);

-- Jobbsökare får inte längre hard-deleta sin ansökan
DROP POLICY IF EXISTS "Users can delete their own applications" ON public.job_applications;

-- Arbetsgivare får inte röra dölj-flaggan
CREATE OR REPLACE FUNCTION public.guard_job_application_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = OLD.applicant_id THEN
    RETURN NEW;
  END IF;

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
  NEW.hidden_by_applicant_at     := OLD.hidden_by_applicant_at;

  RETURN NEW;
END;
$$;