REVOKE SELECT (user_id, hidden_author_id) ON public.company_reviews FROM authenticated;
REVOKE SELECT (user_id, hidden_author_id) ON public.company_reviews FROM anon;