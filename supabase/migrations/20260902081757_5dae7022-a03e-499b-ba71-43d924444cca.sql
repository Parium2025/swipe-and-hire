ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS cover_image_snapshot_url text;

CREATE INDEX IF NOT EXISTS idx_job_applications_cover_image_snapshot_url
  ON public.job_applications(cover_image_snapshot_url)
  WHERE cover_image_snapshot_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fill_application_profile_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate public.candidate_profiles%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_prefix text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.applicant_id THEN
    RAISE EXCEPTION 'application_applicant_mismatch' USING ERRCODE = '42501';
  END IF;

  v_prefix := NEW.applicant_id::text || '/%';

  IF NEW.candidate_profile_id IS NOT NULL THEN
    SELECT * INTO v_candidate
    FROM public.candidate_profiles
    WHERE id = NEW.candidate_profile_id;

    IF FOUND THEN
      IF v_candidate.user_id <> NEW.applicant_id THEN
        RAISE EXCEPTION 'candidate_profile_not_owned' USING ERRCODE = '42501';
      END IF;

      NEW.candidate_profile_label := v_candidate.label;
      NEW.cv_url := v_candidate.cv_url;
      NEW.profile_image_snapshot_url := v_candidate.profile_image_url;
      NEW.video_snapshot_url := v_candidate.video_url;
      NEW.cover_image_snapshot_url := v_candidate.cover_image_url;
    ELSE
      NEW.candidate_profile_id := NULL;
      IF NEW.candidate_profile_label IS NULL THEN
        RAISE EXCEPTION 'candidate_profile_missing' USING ERRCODE = '23503';
      END IF;
    END IF;
  ELSIF NEW.candidate_profile_label IS NULL THEN
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE user_id = NEW.applicant_id;

    IF FOUND THEN
      NEW.cv_url := v_profile.cv_url;
      NEW.profile_image_snapshot_url := v_profile.profile_image_url;
      NEW.video_snapshot_url := v_profile.video_url;
      NEW.cover_image_snapshot_url := v_profile.cover_image_url;
    END IF;
  END IF;

  IF (NEW.cv_url IS NOT NULL AND NEW.cv_url NOT LIKE v_prefix)
     OR (NEW.profile_image_snapshot_url IS NOT NULL AND NEW.profile_image_snapshot_url NOT LIKE v_prefix)
     OR (NEW.video_snapshot_url IS NOT NULL AND NEW.video_snapshot_url NOT LIKE v_prefix)
     OR (NEW.cover_image_snapshot_url IS NOT NULL AND NEW.cover_image_snapshot_url NOT LIKE v_prefix) THEN
    RAISE EXCEPTION 'application_snapshot_path_not_owned' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fill_application_profile_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fill_application_profile_snapshot() TO service_role;

CREATE OR REPLACE FUNCTION public.guard_job_application_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = OLD.applicant_id THEN
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
    NEW.cover_image_snapshot_url   := OLD.cover_image_snapshot_url;
    NEW.questions_snapshot         := OLD.questions_snapshot;
    NEW.candidate_profile_id       := OLD.candidate_profile_id;
    NEW.candidate_profile_label    := OLD.candidate_profile_label;
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
  NEW.cover_image_snapshot_url   := OLD.cover_image_snapshot_url;
  NEW.questions_snapshot         := OLD.questions_snapshot;
  NEW.candidate_profile_id       := OLD.candidate_profile_id;
  NEW.candidate_profile_label    := OLD.candidate_profile_label;
  NEW.hidden_by_applicant_at     := OLD.hidden_by_applicant_at;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_job_application_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_job_application_columns() TO service_role;