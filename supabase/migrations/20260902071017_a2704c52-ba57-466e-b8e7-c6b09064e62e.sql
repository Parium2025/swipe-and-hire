ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_applications_candidate_profile_id
  ON public.job_applications(candidate_profile_id)
  WHERE candidate_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_applications_profile_image_snapshot_url
  ON public.job_applications(profile_image_snapshot_url)
  WHERE profile_image_snapshot_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_applications_video_snapshot_url
  ON public.job_applications(video_snapshot_url)
  WHERE video_snapshot_url IS NOT NULL;

CREATE TABLE public.media_deletion_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  storage_path text NOT NULL,
  media_kind text NOT NULL,
  not_before timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, storage_path)
);

GRANT ALL ON public.media_deletion_queue TO service_role;

ALTER TABLE public.media_deletion_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_media_deletion_queue_due
  ON public.media_deletion_queue(not_before, created_at);

CREATE TRIGGER trg_media_deletion_queue_updated_at
BEFORE UPDATE ON public.media_deletion_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.queue_profile_media_deletion(
  p_bucket text,
  p_storage_path text,
  p_media_kind text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_path text;
BEGIN
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RETURN;
  END IF;

  v_clean_path := split_part(p_storage_path, '?', 1);

  INSERT INTO public.media_deletion_queue(bucket, storage_path, media_kind)
  VALUES (p_bucket, v_clean_path, p_media_kind)
  ON CONFLICT (bucket, storage_path)
  DO UPDATE SET
    not_before = LEAST(public.media_deletion_queue.not_before, EXCLUDED.not_before),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.queue_profile_media_deletion(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_profile_media_deletion(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_replaced_profile_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.cv_url IS DISTINCT FROM NEW.cv_url THEN
    PERFORM public.queue_profile_media_deletion('job-applications', OLD.cv_url, 'cv');
  END IF;
  IF TG_OP = 'DELETE' OR OLD.video_url IS DISTINCT FROM NEW.video_url THEN
    PERFORM public.queue_profile_media_deletion('job-applications', OLD.video_url, 'profile-video');
  END IF;
  IF TG_OP = 'DELETE' OR OLD.profile_image_url IS DISTINCT FROM NEW.profile_image_url THEN
    PERFORM public.queue_profile_media_deletion('job-applications', OLD.profile_image_url, 'profile-image');
  END IF;
  IF TG_OP = 'DELETE' OR OLD.cover_image_url IS DISTINCT FROM NEW.cover_image_url THEN
    PERFORM public.queue_profile_media_deletion('job-applications', OLD.cover_image_url, 'cover-image');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_replaced_profile_media() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_replaced_profile_media() TO service_role;

DROP TRIGGER IF EXISTS trg_candidate_profiles_queue_replaced_media ON public.candidate_profiles;
CREATE TRIGGER trg_candidate_profiles_queue_replaced_media
AFTER UPDATE OF cv_url, video_url, profile_image_url, cover_image_url OR DELETE
ON public.candidate_profiles
FOR EACH ROW EXECUTE FUNCTION public.enqueue_replaced_profile_media();

DROP TRIGGER IF EXISTS trg_profiles_queue_replaced_media ON public.profiles;
CREATE TRIGGER trg_profiles_queue_replaced_media
AFTER UPDATE OF cv_url, video_url, profile_image_url, cover_image_url OR DELETE
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enqueue_replaced_profile_media();

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
    ELSE
      -- En offlinekö kan bära en profil som tagits bort efter köögonblicket.
      -- Behåll då den redan frysta snapshoten, men aldrig ett främmande filprefix.
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
    END IF;
  END IF;

  IF (NEW.cv_url IS NOT NULL AND NEW.cv_url NOT LIKE v_prefix)
     OR (NEW.profile_image_snapshot_url IS NOT NULL AND NEW.profile_image_snapshot_url NOT LIKE v_prefix)
     OR (NEW.video_snapshot_url IS NOT NULL AND NEW.video_snapshot_url NOT LIKE v_prefix) THEN
    RAISE EXCEPTION 'application_snapshot_path_not_owned' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fill_application_profile_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fill_application_profile_snapshot() TO service_role;

DROP TRIGGER IF EXISTS trg_fill_application_profile_snapshot ON public.job_applications;
CREATE TRIGGER trg_fill_application_profile_snapshot
BEFORE INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.fill_application_profile_snapshot();

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
  NEW.questions_snapshot         := OLD.questions_snapshot;
  NEW.candidate_profile_id       := OLD.candidate_profile_id;
  NEW.candidate_profile_label    := OLD.candidate_profile_label;
  NEW.hidden_by_applicant_at     := OLD.hidden_by_applicant_at;

  RETURN NEW;
END;
$$;