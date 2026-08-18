-- 1. Lists
CREATE TABLE public.candidate_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_lists TO authenticated;
GRANT ALL ON public.candidate_lists TO service_role;

ALTER TABLE public.candidate_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their lists"
  ON public.candidate_lists FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Organization members can view colleagues lists"
  ON public.candidate_lists FOR SELECT TO authenticated
  USING (public.same_organization(auth.uid(), owner_id));
CREATE POLICY "Owners can create lists"
  ON public.candidate_lists FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their lists"
  ON public.candidate_lists FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their lists"
  ON public.candidate_lists FOR DELETE TO authenticated
  USING (auth.uid() = owner_id AND is_default = false);

CREATE UNIQUE INDEX idx_candidate_lists_one_default
  ON public.candidate_lists (owner_id) WHERE is_default;
CREATE INDEX idx_candidate_lists_owner ON public.candidate_lists (owner_id, order_index);

CREATE TRIGGER trg_candidate_lists_updated_at
  BEFORE UPDATE ON public.candidate_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Helper: alltid en standardlista per användare
CREATE OR REPLACE FUNCTION public.ensure_default_candidate_list(p_owner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_owner_id
     AND NOT public.same_organization(auth.uid(), p_owner_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT id INTO v_id
  FROM public.candidate_lists
  WHERE owner_id = p_owner_id AND is_default
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.candidate_lists (owner_id, name, order_index, is_default)
    VALUES (p_owner_id, 'Mina kandidater', 0, true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      SELECT id INTO v_id
      FROM public.candidate_lists
      WHERE owner_id = p_owner_id AND is_default
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_candidate_list(uuid) TO authenticated, service_role;

-- 3. Backfill standardlistor för alla som redan har kandidater eller egna steg
INSERT INTO public.candidate_lists (owner_id, name, order_index, is_default)
SELECT DISTINCT recruiter_id, 'Mina kandidater', 0, true FROM public.my_candidates
ON CONFLICT DO NOTHING;

INSERT INTO public.candidate_lists (owner_id, name, order_index, is_default)
SELECT DISTINCT user_id, 'Mina kandidater', 0, true FROM public.user_stage_settings
ON CONFLICT DO NOTHING;

-- 4. list_id på my_candidates
ALTER TABLE public.my_candidates
  ADD COLUMN list_id uuid REFERENCES public.candidate_lists(id) ON DELETE CASCADE;

UPDATE public.my_candidates mc
SET list_id = cl.id
FROM public.candidate_lists cl
WHERE cl.owner_id = mc.recruiter_id AND cl.is_default AND mc.list_id IS NULL;

CREATE INDEX idx_my_candidates_list ON public.my_candidates (recruiter_id, list_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_my_candidate_default_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.list_id IS NULL THEN
    NEW.list_id := public.ensure_default_candidate_list(NEW.recruiter_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_my_candidates_default_list
  BEFORE INSERT ON public.my_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_my_candidate_default_list();

-- 5. list_id på user_stage_settings (unika steg per lista)
ALTER TABLE public.user_stage_settings
  ADD COLUMN list_id uuid REFERENCES public.candidate_lists(id) ON DELETE CASCADE;

UPDATE public.user_stage_settings uss
SET list_id = cl.id
FROM public.candidate_lists cl
WHERE cl.owner_id = uss.user_id AND cl.is_default AND uss.list_id IS NULL;

ALTER TABLE public.user_stage_settings
  DROP CONSTRAINT IF EXISTS user_stage_settings_user_id_stage_key_key;

CREATE UNIQUE INDEX idx_user_stage_settings_unique
  ON public.user_stage_settings (user_id, list_id, stage_key);
CREATE INDEX idx_user_stage_settings_list ON public.user_stage_settings (list_id, order_index);

CREATE OR REPLACE FUNCTION public.set_stage_setting_default_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.list_id IS NULL THEN
    NEW.list_id := public.ensure_default_candidate_list(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_stage_settings_default_list
  BEFORE INSERT ON public.user_stage_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_stage_setting_default_list();

-- 6. Sök per lista
CREATE OR REPLACE FUNCTION public.search_my_candidates(
  p_recruiter_id uuid,
  p_search_query text,
  p_limit integer DEFAULT 50,
  p_cursor_updated_at timestamp with time zone DEFAULT NULL,
  p_list_id uuid DEFAULT NULL
)
RETURNS TABLE(my_candidate_id uuid, application_id uuid, applicant_id uuid, job_id uuid, stage text, notes text, rating integer, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tsquery tsquery;
  v_sanitized text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_recruiter_id THEN
    RETURN;
  END IF;

  v_sanitized := regexp_replace(trim(p_search_query), '[&|!:*()''<>\\\-]', '', 'g');

  v_tsquery := to_tsquery('simple',
    array_to_string(
      array(
        SELECT word || ':*'
        FROM unnest(string_to_array(v_sanitized, ' ')) AS word
        WHERE word <> ''
      ),
      ' & '
    )
  );

  RETURN QUERY
  SELECT
    mc.id as my_candidate_id,
    mc.application_id,
    mc.applicant_id,
    mc.job_id,
    mc.stage,
    mc.notes,
    mc.rating,
    mc.created_at,
    mc.updated_at
  FROM my_candidates mc
  JOIN job_applications ja ON ja.id = mc.application_id
  WHERE mc.recruiter_id = p_recruiter_id
    AND (p_list_id IS NULL OR mc.list_id = p_list_id)
    AND ja.search_vector @@ v_tsquery
    AND (p_cursor_updated_at IS NULL OR mc.updated_at < p_cursor_updated_at)
  ORDER BY mc.updated_at DESC
  LIMIT p_limit;
END;
$function$;