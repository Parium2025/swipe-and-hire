CREATE OR REPLACE FUNCTION public.test_search_employer_candidates()
RETURNS TABLE(
  id uuid, job_id uuid, applicant_id uuid, first_name text, last_name text,
  email text, phone text, location text, bio text, cv_url text, age integer,
  employment_status text, work_schedule text, availability text,
  custom_answers jsonb, questions_snapshot jsonb, status text,
  applied_at timestamp with time zone, updated_at timestamp with time zone,
  viewed_at timestamp with time zone, job_title text, job_occupation text,
  rating integer, total_count bigint, match_source text, account_deleted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '7efa4356-ded1-4fb4-b771-9c72313459e4', true);
  RETURN QUERY SELECT * FROM public.search_employer_candidates(p_search := 'Fredrik', p_limit := 5);
END;
$$;