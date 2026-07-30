-- 1) job_questions: dela upp publik läsning och intern åtkomst
DROP POLICY IF EXISTS "View questions for active jobs or organization jobs" ON public.job_questions;
CREATE POLICY "Public can view questions for active jobs"
ON public.job_questions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.job_postings jp WHERE jp.id = job_questions.job_id AND jp.is_active = true AND jp.deleted_at IS NULL));
CREATE POLICY "Employers can view own or org job questions"
ON public.job_questions FOR SELECT TO authenticated
USING (
  public.employer_owns_job_for_question(job_id)
  OR EXISTS (SELECT 1 FROM public.job_postings jp WHERE jp.id = job_questions.job_id AND public.same_organization(auth.uid(), jp.employer_id))
);

-- 2) Alla auth-beroende policies begränsas till inloggade
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text = '{public}'
      AND (coalesce(qual,'') || coalesce(with_check,'')) ~ 'auth\.(uid|jwt)'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3) Ta bort anon-körrätt på interna funktioner
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'pg_catalog.trigger'::regtype
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname NOT IN (
        'search_jobs','count_search_jobs','try_uuid',
        'get_employer_public_profile','get_employer_public_profiles',
        'record_job_view','record_app_exception','increment_app_exception_count'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;