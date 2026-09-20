CREATE OR REPLACE FUNCTION public.job_postings_generate_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_extra text := '';
BEGIN
  v_extra := v_extra || ' ' || COALESCE(
    CASE NEW.employment_type
      WHEN 'full_time' THEN 'heltid'
      WHEN 'part_time' THEN 'deltid'
      WHEN 'contract' THEN 'konsult kontrakt visstid'
      WHEN 'interim' THEN 'interim'
      WHEN 'internship' THEN 'praktik internship'
      WHEN 'summer_job' THEN 'sommarjobb'
      WHEN 'temporary' THEN 'vikariat tillfalligt'
      ELSE NEW.employment_type
    END, '');

  v_extra := v_extra || ' ' || COALESCE(replace(NEW.work_schedule, '-', ' '), '');

  IF NEW.part_time_shifts IS NOT NULL THEN
    v_extra := v_extra || ' ' || COALESCE((
      SELECT string_agg(
        CASE s
          WHEN 'day' THEN 'dag dagtid dagpass dagskift'
          WHEN 'evening' THEN 'kväll kvällstid kvällspass kvällsskift'
          WHEN 'night' THEN 'natt nattetid nattpass nattskift nattjobb'
          ELSE s
        END, ' ')
      FROM unnest(NEW.part_time_shifts) AS s
    ), '');
  END IF;

  IF NEW.part_time_days IS NOT NULL THEN
    v_extra := v_extra || ' ' || COALESCE((
      SELECT string_agg(
        CASE d
          WHEN 'mon' THEN 'måndag'
          WHEN 'tue' THEN 'tisdag'
          WHEN 'wed' THEN 'onsdag'
          WHEN 'thu' THEN 'torsdag'
          WHEN 'fri' THEN 'fredag'
          WHEN 'sat' THEN 'lördag helg helger helgjobb'
          WHEN 'sun' THEN 'söndag helg helger helgjobb'
          ELSE d
        END, ' ')
      FROM unnest(NEW.part_time_days) AS d
    ), '');
  END IF;

  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_city, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_municipality, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_county, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.occupation, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.requirements, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.pitch, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_name, '')), 'D') ||
    setweight(to_tsvector('simple', COALESCE(NEW.workplace_address, '')), 'D') ||
    setweight(to_tsvector('simple', lower(v_extra)), 'D');
  RETURN NEW;
END;
$$;

UPDATE public.job_postings SET updated_at = updated_at;