
-- 1) Enable pgvector for semantic embeddings cache
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Lock down ai_usage_log with RLS + admin-only read
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;

DROP POLICY IF EXISTS "Only platform admins can read ai_usage_log" ON public.ai_usage_log;
CREATE POLICY "Only platform admins can read ai_usage_log"
  ON public.ai_usage_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- No client-side writes; only edge functions (service role) insert.
DROP POLICY IF EXISTS "Service role writes ai_usage_log" ON public.ai_usage_log;
CREATE POLICY "Service role writes ai_usage_log"
  ON public.ai_usage_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3) Semantic embeddings cache for criterion prompts.
-- Idea: hash-cache stops exact repeats (already built). Embeddings-cache
-- catches semantic near-duplicates ("har körkort för bil" ≈ "b-behörighet")
-- BEFORE they trigger a fresh AI evaluation. One tiny embedding call
-- (~$0.00001) replaces a full evaluation (~$0.001–0.01).
--
-- Row per unique criterion_hash we've ever seen. We embed the normalized
-- prompt once, then reuse the embedding for every future similarity search.
CREATE TABLE IF NOT EXISTS public.criterion_prompt_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  criterion_hash TEXT NOT NULL UNIQUE,
  normalized_prompt TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.criterion_prompt_embeddings TO authenticated;
GRANT ALL ON public.criterion_prompt_embeddings TO service_role;

ALTER TABLE public.criterion_prompt_embeddings ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user so evaluate-candidate can look up neighbours
-- from any employer's session (all data is non-sensitive prompt text + vector).
DROP POLICY IF EXISTS "Anyone signed-in can read prompt embeddings" ON public.criterion_prompt_embeddings;
CREATE POLICY "Anyone signed-in can read prompt embeddings"
  ON public.criterion_prompt_embeddings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role writes.
DROP POLICY IF EXISTS "Service role writes prompt embeddings" ON public.criterion_prompt_embeddings;
CREATE POLICY "Service role writes prompt embeddings"
  ON public.criterion_prompt_embeddings
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- HNSW index for fast cosine-similarity nearest-neighbour lookup.
-- 1536 dims fits directly under the 2000-dim cap, so no halfvec cast needed.
CREATE INDEX IF NOT EXISTS criterion_prompt_embeddings_embedding_idx
  ON public.criterion_prompt_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- 4) Match function: find semantically similar prompts we've already scored
-- for a given candidate context. Returns criterion_hash + result so the
-- edge function can skip a fresh AI call.
CREATE OR REPLACE FUNCTION public.match_criterion_prompt(
  query_embedding vector(1536),
  match_context_hash text,
  similarity_threshold float DEFAULT 0.95,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  criterion_hash text,
  similarity float,
  result text,
  confidence numeric,
  reasoning text,
  source text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.criterion_hash,
    1 - (e.embedding <=> query_embedding) AS similarity,
    cr.result,
    cr.confidence,
    cr.reasoning,
    cr.source
  FROM public.criterion_prompt_embeddings e
  JOIN LATERAL (
    SELECT result, confidence, reasoning, source
    FROM public.criterion_results
    WHERE criterion_hash = e.criterion_hash
      AND context_hash = match_context_hash
    LIMIT 1
  ) cr ON true
  WHERE 1 - (e.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_criterion_prompt(vector, text, float, int) TO authenticated, service_role;
