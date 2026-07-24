DROP POLICY IF EXISTS "Anyone signed-in can read prompt embeddings" ON public.criterion_prompt_embeddings;
REVOKE SELECT ON public.criterion_prompt_embeddings FROM authenticated;