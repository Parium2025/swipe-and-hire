DO $$
DECLARE
  src text;
  newsrc text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc WHERE proname = 'get_employer_analytics_v2';

  newsrc := replace(src,
E'    FROM public.interviews i\n    JOIN org_job_ids oji ON oji.id = i.job_id\n    WHERE i.created_at >= v_cutoff\n',
E'    FROM public.interviews i\n    WHERE i.employer_id IN (SELECT user_id FROM org_members)\n      AND i.created_at >= v_cutoff\n');

  newsrc := replace(newsrc,
E'    FROM public.interviews i\n    JOIN org_job_ids oji ON oji.id = i.job_id\n    WHERE i.created_at >= v_prev_cutoff\n',
E'    FROM public.interviews i\n    WHERE i.employer_id IN (SELECT user_id FROM org_members)\n      AND i.created_at >= v_prev_cutoff\n');

  IF newsrc = src THEN
    RAISE EXCEPTION 'Patch matchade inte källkoden för get_employer_analytics_v2';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_employer_analytics_v2(p_user_id uuid, p_days_back integer DEFAULT NULL::integer) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS %L',
    newsrc
  );
END $$;