CREATE TABLE public.review_content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('review','company_reply','message')),
  review_id uuid NOT NULL REFERENCES public.company_reviews(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.company_review_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','removed','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE UNIQUE INDEX uq_review_content_reports_once ON public.review_content_reports
  (reporter_id, review_id, target_type, coalesce(message_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_review_content_reports_status ON public.review_content_reports(status, created_at DESC);

GRANT SELECT ON public.review_content_reports TO authenticated;
GRANT ALL ON public.review_content_reports TO service_role;
ALTER TABLE public.review_content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins read reports" ON public.review_content_reports
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.report_review_content(_target_type text, _review_id uuid, _message_id uuid, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _target_type NOT IN ('review','company_reply','message') THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_reviews WHERE id = _review_id) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _target_type = 'message' AND NOT EXISTS (SELECT 1 FROM public.company_review_messages WHERE id = _message_id AND review_id = _review_id) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF _target_type = 'company_reply' AND NOT EXISTS (SELECT 1 FROM public.company_reviews WHERE id = _review_id AND employer_reply IS NOT NULL) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF (SELECT count(*) FROM public.review_content_reports WHERE reporter_id = auth.uid() AND created_at > now() - interval '1 hour') >= 20 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  INSERT INTO public.review_content_reports(target_type, review_id, message_id, reporter_id, reason)
  VALUES (_target_type, _review_id, CASE WHEN _target_type = 'message' THEN _message_id END, auth.uid(), nullif(left(btrim(coalesce(_reason,'')), 500), ''))
  ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.report_review_content(text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_review_content(text, uuid, uuid, text) TO authenticated;

-- Admin: lista öppna anmälningar med innehållet.
CREATE OR REPLACE FUNCTION public.admin_list_review_reports()
RETURNS TABLE(report_id uuid, target_type text, review_id uuid, message_id uuid, content text, company_name text, reason text, report_count bigint, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (rr.review_id, rr.target_type, rr.message_id)
    rr.id, rr.target_type, rr.review_id, rr.message_id,
    CASE rr.target_type WHEN 'review' THEN cr.comment WHEN 'company_reply' THEN cr.employer_reply ELSE m.body END,
    p.company_name, rr.reason,
    count(*) OVER (PARTITION BY rr.review_id, rr.target_type, rr.message_id),
    rr.created_at
  FROM public.review_content_reports rr
  JOIN public.company_reviews cr ON cr.id = rr.review_id
  LEFT JOIN public.company_review_messages m ON m.id = rr.message_id
  LEFT JOIN public.profiles p ON p.user_id = cr.company_id
  WHERE rr.status = 'open'
  ORDER BY rr.review_id, rr.target_type, rr.message_id, rr.created_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_review_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_review_reports() TO authenticated;

-- Admin: ta bort innehållet eller avfärda anmälan.
CREATE OR REPLACE FUNCTION public.admin_resolve_review_report(_report_id uuid, _remove boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO r FROM public.review_content_reports WHERE id = _report_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.review_content_reports
    SET status = CASE WHEN _remove THEN 'removed' ELSE 'dismissed' END, resolved_at = now(), resolved_by = auth.uid()
    WHERE review_id = r.review_id AND target_type = r.target_type AND message_id IS NOT DISTINCT FROM r.message_id AND status = 'open';
  IF _remove THEN
    IF r.target_type = 'review' THEN
      DELETE FROM public.company_reviews WHERE id = r.review_id;
    ELSIF r.target_type = 'company_reply' THEN
      UPDATE public.company_reviews SET employer_reply = NULL, employer_reply_at = NULL, employer_reply_by = NULL WHERE id = r.review_id;
    ELSE
      DELETE FROM public.company_review_messages WHERE id = r.message_id;
    END IF;
  END IF;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_review_report(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_review_report(uuid, boolean) TO authenticated;