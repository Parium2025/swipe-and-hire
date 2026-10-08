REVOKE SELECT ON public.company_review_messages FROM authenticated, anon;
GRANT SELECT (id, review_id, author_kind, body, created_at) ON public.company_review_messages TO authenticated;