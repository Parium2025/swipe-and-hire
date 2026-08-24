import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildAliasPromptBlock, aliasSignature } from "../_shared/domain-aliases.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Bump this when the AI system prompt / evaluation logic changes materially.
// Included in criterion_hash → forces a global cache invalidation for all criteria.
const PROMPT_VERSION = 'v2026-08-24-aliases2';

// Normalize prompt text before hashing so tiny cosmetic edits don't invalidate
// the cache. Lowercases, trims, collapses whitespace, strips trailing punctuation.
// "Har B-körkort" → "har b-körkort"  |  "Har  B-körkort." → same hash.
function normalizeForHash(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/[.,;:!?"'`´]+$/g, '')
    .trim();
}

// ─── Per-user rate limiting (in-memory token bucket, per edge instance) ──
// Only counts FRESH AI calls (cache hits are free and never rate-limited).
// Cap is generous so an employer can bulk-evaluate a full ad (500–1000
// ansökningar) without hitting the ceiling; it's a runaway-loop safety net,
// not a throttle for normal use. Instance-local — best-effort distributed cap.
const RATE_LIMIT_MAX = 600;          // fresh AI calls per user
const RATE_LIMIT_WINDOW_MS = 60_000; // per minute
const rateLimitBuckets = new Map<string, number[]>();

function checkRateLimit(userId: string, cost = 1): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const bucket = (rateLimitBuckets.get(userId) || []).filter(t => t > cutoff);
  if (bucket.length + cost > RATE_LIMIT_MAX) {
    const oldest = bucket[0] ?? now;
    return { allowed: false, retryAfterSec: Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000) };
  }
  for (let i = 0; i < cost; i++) bucket.push(now);
  rateLimitBuckets.set(userId, bucket);
  if (rateLimitBuckets.size > 500) {
    for (const [k, v] of rateLimitBuckets) {
      const kept = v.filter(t => t > cutoff);
      if (kept.length === 0) rateLimitBuckets.delete(k);
      else rateLimitBuckets.set(k, kept);
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}

// ─── Embeddings cache (semantic near-duplicate detection) ────────────
// Turns prompts into a 1536-dim vector via Lovable AI's embeddings endpoint.
// Two prompts that mean the same thing but use different words end up ~1.0
// cosine-similar → we can reuse a previous AI evaluation without re-running.
// Cost: ~$0.00001 per embedding vs ~$0.001–0.01 per full evaluation.
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const EMBEDDING_SIMILARITY_THRESHOLD = 0.95;

async function embedText(apiKey: string, text: string): Promise<number[] | null> {
  try {
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    });
    if (!resp.ok) {
      console.warn('Embedding call failed:', resp.status);
      return null;
    }
    const data = await resp.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.warn('Embedding error (non-blocking):', err);
    return null;
  }
}

interface CriterionResult {
  criterion_id: string;
  title: string;
  result: 'match' | 'no_match';
  confidence: number;
  reasoning: string;
  source: string;
}

interface EvaluationResponse {
  criteria_results: CriterionResult[];
  summary_text?: string;
  key_points?: Array<{ text: string; type?: string }>;
}

// Terminalt/övergående gatewayfel som måste behålla sin HTTP-status hela vägen
// ut till anroparen (kö-workern bryter kedjan på 402/403 och backar av på 429).
class GatewayError extends Error {
  constructor(public status: number, public body: string) {
    super(`AI gateway ${status}: ${body.slice(0, 200)}`);
    this.name = 'GatewayError';
  }
}

// Retry with exponential backoff

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelayMs = 1000,
  timeoutMs = 60000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.log(`Attempt ${attempt + 1} failed (${response.status}), retrying in ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        const isAbortError = error instanceof Error && error.name === 'AbortError';
        console.log(`Attempt ${attempt + 1} ${isAbortError ? 'timeout' : 'network error'}, retrying in ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('fetchWithRetry: exhausted retries');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH: require valid JWT ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const job_id = body.job_id || body.jobId;
    const applicant_id = body.applicant_id || body.applicantId;
    const application_id = body.application_id || body.applicationId;
    const action = body.action;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get caller identity (allow service_role bypass for internal calls)
    const token = authHeader.replace('Bearer ', '').trim();
    const isServiceRole = token === supabaseServiceKey;
    let callerId: string | null = null;
    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if ((claimsData.claims as { role?: string }).role !== 'service_role') {
        callerId = claimsData.claims.sub as string;
      }
    }

    // Rate-limit is now enforced AFTER cache resolution — cache hits are free.
    // See checkRateLimit call further down (only fresh AI calls count).



    // Action: validate_criterion — AI-powered discrimination check
    if (action === 'validate_criterion') {
      const { prompt, title } = body;
      if (!prompt && !title) {
        return new Response(
          JSON.stringify({ isDiscriminatory: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ isDiscriminatory: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const discriminationCheck = await checkDiscriminationWithAI(LOVABLE_API_KEY, title || '', prompt || '');
      return new Response(JSON.stringify(discriminationCheck), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!job_id || !applicant_id) {
      return new Response(
        JSON.stringify({ error: 'job_id and applicant_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === AUTHORIZATION: caller must be applicant OR employer of the job ===
    if (callerId !== null && callerId !== applicant_id) {
      const { data: canView, error: authzError } = await supabase
        .rpc('can_view_job_application', { p_job_id: job_id }, { get: false })
        .single();
      // Fallback: check via employer_owns_job_for_question style check by querying job_postings
      let allowed = false;
      if (!authzError && canView === true) {
        allowed = true;
      } else {
        // Direct ownership check as fallback
        const { data: job, error: jobError } = await supabase
          .from('job_postings')
          .select('employer_id')
          .eq('id', job_id)
          .maybeSingle();
        if (jobError) console.warn('evaluate-candidate job lookup failed:', jobError.message);
        if (job) {
          if (job.employer_id === callerId) {
            allowed = true;
          } else {
            // Same-organization colleague check (roles hold the org, not job_postings)
            const [callerOrg, ownerOrg] = await Promise.all([
              supabase.rpc('get_user_organization_id', { p_user_id: callerId }),
              supabase.rpc('get_user_organization_id', { p_user_id: job.employer_id }),
            ]);
            if (callerOrg.data && ownerOrg.data && callerOrg.data === ownerOrg.data) {
              allowed = true;
            }
          }
        }
      }
      if (!allowed) {
        console.warn(`Unauthorized evaluate-candidate: caller=${callerId} job=${job_id} applicant=${applicant_id}`);
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const evalStartMs = Date.now();
    console.log(`Evaluating candidate ${applicant_id} for job ${job_id}`);


    // Fetch ALL data in parallel
    const [jobResult, criteriaResult, questionsResult, applicationResult, profileResult, cvSummaryResult, profileCvResult, feedbackResult] = await Promise.all([
      supabase.from('job_postings').select('*').eq('id', job_id).single(),
      supabase.from('job_criteria').select('*').eq('job_id', job_id).eq('is_active', true).order('order_index'),
      supabase.from('job_questions').select('*').eq('job_id', job_id).order('order_index'),
      supabase.from('job_applications').select('*').eq('job_id', job_id).eq('applicant_id', applicant_id).single(),
      supabase.from('profiles').select('*').eq('user_id', applicant_id).single(),
      supabase.from('candidate_summaries').select('*').eq('job_id', job_id).eq('applicant_id', applicant_id).single(),
      supabase.from('profile_cv_summaries').select('*').eq('user_id', applicant_id).single(),
      // Fetch recruiter feedback for this job's criteria (for few-shot learning)
      supabase.from('criterion_feedback').select('*').eq('job_id', job_id).order('created_at', { ascending: false }).limit(20),
    ]);

    const job = jobResult.data;
    if (jobResult.error || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const criteria = criteriaResult.data || [];
    const questions = questionsResult.data || [];
    const application = applicationResult.data;
    const profile = profileResult.data;
    const cvSummary = cvSummaryResult.data;
    const profileCv = profileCvResult.data;
    const feedback = feedbackResult.data || [];

    if (criteria.length === 0) {
      return new Response(
        JSON.stringify({ success: true, criteria_results: [], message: 'No active criteria to evaluate' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update evaluation record
    const { data: evaluation, error: evalError } = await supabase
      .from('candidate_evaluations')
      .upsert({
        job_id,
        applicant_id,
        application_id: application?.id,
        status: 'processing',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'job_id,applicant_id' })
      .select()
      .single();

    if (evalError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create evaluation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze video CV if available (and no text CV exists)
    let videoAnalysis: string | null = null;
    const hasTextCv = (cvSummary?.raw_text || profileCv?.raw_text || cvSummary?.summary_text || profileCv?.summary_text);
    const videoUrl = profile?.video_url;
    
    if (videoUrl && profile?.is_profile_video) {
      try {
        videoAnalysis = await analyzeVideoCV(supabase, LOVABLE_API_KEY, videoUrl);
      } catch (err) {
        console.error('Video CV analysis failed (non-blocking):', err);
      }
    }

    // Build rich context
    const candidateContext = buildCandidateContext(application, profile, questions, cvSummary, profileCv, videoAnalysis);
    const jobContext = buildJobContext(job, criteria, questions);
    const feedbackContext = buildFeedbackContext(feedback, criteria);
    const feedbackByCriterion = buildFeedbackByCriterion(feedback, criteria);

    // ─── GLOBAL HASH-BASED CACHE ─────────────────────────────────────
    // context_hash = candidate data ONLY (feedback is per-criterion below).
    // criterion_hash includes per-criterion feedback → a correction on
    // criterion A doesn't invalidate criteria B, C, D for the same candidate.
    // Cache lookup keys on (criterion_hash, context_hash) — NOT criterion_id —
    // so the same prompt against the same candidate data is reused across
    // every job and every organization. Same criterion + same candidate = free.
    const contextHash = await sha256(candidateContext);
    const criteriaWithHashes = await Promise.all(
      criteria.map(async (c: any) => {
        const perCriterionFeedback = feedbackByCriterion.get(c.id) || '';
        const normTitle = normalizeForHash(c.title);
        const normPrompt = normalizeForHash(c.prompt);
        // Aliaslexikonet påverkar bedömningen → in i hashen, men bara de grupper
        // som just DETTA kriterium triggar (syskonkriterier ska inte invalidera).
        const aliasSig = aliasSignature([c?.title, c?.prompt].filter(Boolean));
        return {
          ...c,
          _criterion_hash: await sha256(
            `${PROMPT_VERSION}||${normTitle}||${normPrompt}||${perCriterionFeedback}||${aliasSig}`
          ),
        };
      })
    );


    const criterionHashes = Array.from(new Set(criteriaWithHashes.map(c => c._criterion_hash)));
    const { data: cachedRows } = await supabase
      .from('criterion_results')
      .select('result, confidence, reasoning, source, criterion_hash')
      .in('criterion_hash', criterionHashes)
      .eq('context_hash', contextHash)
      .limit(criterionHashes.length * 5);

    // Pick first row per criterion_hash (all rows with same hash are semantically identical).
    const cachedByHash = new Map<string, any>();
    (cachedRows || []).forEach((row: any) => {
      if (row.criterion_hash && !cachedByHash.has(row.criterion_hash)) {
        cachedByHash.set(row.criterion_hash, row);
      }
    });

    const cachedResults: any[] = [];
    const criteriaToEvaluate: any[] = [];
    for (const c of criteriaWithHashes) {
      const hit = cachedByHash.get(c._criterion_hash);
      if (hit) {
        cachedResults.push({
          criterion_id: c.id,
          title: c.title,
          result: hit.result,
          confidence: hit.confidence,
          reasoning: hit.reasoning,
          source: hit.source,
          _from_cache: true,
        });
      } else {
        criteriaToEvaluate.push(c);
      }
    }

    console.log(`Cache (global hash): ${cachedResults.length} hit / ${criteriaToEvaluate.length} miss (of ${criteria.length} criteria)`);

    // ─── SEMANTIC CACHE (embeddings, punkt D) ───────────────────────
    // For each hash-miss, embed the normalized prompt and look for a
    // semantically equivalent prompt (cosine similarity ≥ 0.95) that we've
    // already evaluated against the SAME candidate context. If found, reuse
    // the result — no full AI eval needed.
    let semanticHits = 0;
    const stillMissing: any[] = [];
    if (criteriaToEvaluate.length > 0) {
      const semanticResults: Array<{ criterion: any; embedding: number[]; hit: any | null }> = [];
      // Embed all missing prompts in parallel (bounded — usually 1–10).
      await Promise.all(criteriaToEvaluate.map(async (c) => {
        const normText = `${normalizeForHash(c.title)} ${normalizeForHash(c.prompt)}`.trim();
        const embedding = await embedText(LOVABLE_API_KEY, normText);
        if (!embedding) {
          semanticResults.push({ criterion: c, embedding: [], hit: null });
          return;
        }
        // Look up nearest neighbour with same candidate context.
        // pgvector via PostgREST expects the vector as a bracketed string, e.g. "[0.1,0.2,...]".
        const embeddingLiteral = `[${embedding.join(',')}]`;
        const { data: matches, error } = await supabase.rpc('match_criterion_prompt', {
          query_embedding: embeddingLiteral as any,
          match_context_hash: contextHash,
          similarity_threshold: EMBEDDING_SIMILARITY_THRESHOLD,
          match_count: 1,
        });
        const hit = !error && Array.isArray(matches) && matches.length > 0 ? matches[0] : null;
        semanticResults.push({ criterion: c, embedding, hit });
      }));

      for (const { criterion, embedding, hit } of semanticResults) {
        if (hit) {
          semanticHits++;
          cachedResults.push({
            criterion_id: criterion.id,
            title: criterion.title,
            result: hit.result,
            confidence: hit.confidence,
            reasoning: hit.reasoning,
            source: hit.source,
            _from_cache: true,
            _from_semantic_cache: true,
          });
        } else {
          // Keep embedding attached — we'll save it after fresh eval succeeds.
          criterion._embedding = embedding;
          stillMissing.push(criterion);
        }
      }
      criteriaToEvaluate.length = 0;
      criteriaToEvaluate.push(...stillMissing);
      if (semanticHits > 0) {
        console.log(`Cache (semantic): ${semanticHits} extra hit(s) reused; ${criteriaToEvaluate.length} still need AI`);
      }
    }

    // Call AI only for criteria that need fresh evaluation
    let freshResults: CriterionResult[] = [];
    if (criteriaToEvaluate.length > 0) {
      // Rate-limit ONLY fresh AI calls (cache hits are always free)
      if (callerId) {
        const rl = checkRateLimit(callerId, criteriaToEvaluate.length);
        if (!rl.allowed) {
          console.warn(`Rate limit exceeded for user ${callerId}`);
          return new Response(
            JSON.stringify({ error: 'För många utvärderingar just nu. Vänta en stund.', retry_after_seconds: rl.retryAfterSec }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) } }
          );
        }
      }

      // ─── COMBINED PIPE ────────────────────────────────────────────
      // If there's no candidate_summaries row yet BUT we have raw CV text,
      // ask the AI to generate the CV summary in the SAME call. Saves a
      // second generate-cv-summary invocation at first application.
      const rawText = cvSummary?.raw_text || profileCv?.raw_text;
      const alreadyHasSummary = !!(cvSummary?.summary_text);
      const shouldGenerateSummary = !alreadyHasSummary && !!rawText;

      let aiResponse: EvaluationResponse | null = null;
      try {
        aiResponse = await callLovableAI(
          LOVABLE_API_KEY,
          jobContext,
          candidateContext,
          criteriaToEvaluate,
          feedbackContext,
          shouldGenerateSummary,
        );
      } catch (gatewayError) {
        if (gatewayError instanceof GatewayError) {
          // Kunden ska ALDRIG se interna orsaker (krediter, spärrar, kvoter).
          // Neutralt, lugnt meddelande utåt – orsaken loggas internt.
          const userMessage =
            gatewayError.status === 429
              ? 'Hög belastning just nu — granskningen fortsätter automatiskt om en stund.'
              : 'AI-granskningen är tillfälligt otillgänglig. Vi återupptar automatiskt.';

          console.error(
            `[gateway] status=${gatewayError.status} reason=${gatewayError.message?.slice(0, 200)}`,
          );

          await supabase
            .from('candidate_evaluations')
            .update({ status: 'failed', error_message: userMessage, updated_at: new Date().toISOString() })
            .eq('id', evaluation.id);

          // Behåll gatewayens status → kö-workern bryter kedjan istället för
          // att fortsätta bränna igenom hela kandidatlistan.
          return new Response(
            JSON.stringify({ error: userMessage, status: gatewayError.status }),
            { status: gatewayError.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw gatewayError;
      }


      if (!aiResponse) {
        await supabase
          .from('candidate_evaluations')
          .update({ status: 'failed', error_message: 'AI evaluation failed after retries', updated_at: new Date().toISOString() })
          .eq('id', evaluation.id);

        return new Response(
          JSON.stringify({ error: 'AI evaluation failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      freshResults = aiResponse.criteria_results;

      // Persist combined-pipe summary (if AI produced one).
      if (shouldGenerateSummary && aiResponse.summary_text) {
        try {
          await supabase.from('candidate_summaries').upsert({
            job_id,
            applicant_id,
            application_id: application?.id ?? null,
            summary_text: aiResponse.summary_text,
            key_points: aiResponse.key_points ?? [],
            raw_text: rawText,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'job_id,applicant_id' });
          console.log('Combined pipe: candidate_summaries filled from same AI call');
        } catch (err) {
          console.warn('Combined pipe summary upsert failed (non-blocking):', err);
        }
      }

      // Save embeddings for fresh criteria (best-effort, non-blocking).
      const hashByCriterionId = new Map(criteriaWithHashes.map(c => [c.id, c._criterion_hash]));
      const embeddingsToInsert = criteriaToEvaluate
        .filter((c: any) => Array.isArray(c._embedding) && c._embedding.length > 0)
        .map((c: any) => ({
          criterion_hash: hashByCriterionId.get(c.id),
          normalized_prompt: `${normalizeForHash(c.title)} ${normalizeForHash(c.prompt)}`.trim(),
          embedding: `[${(c._embedding as number[]).join(',')}]` as any,
        }))
        .filter((r: any) => !!r.criterion_hash);
      if (embeddingsToInsert.length > 0) {
        supabase
          .from('criterion_prompt_embeddings')
          .upsert(embeddingsToInsert, { onConflict: 'criterion_hash' })
          .then(({ error }) => {
            if (error) console.warn('Embedding upsert failed (non-blocking):', error.message);
          });
      }
    }

    // Persist ONLY fresh results (cached rows already exist in DB)
    if (freshResults.length > 0) {
      const hashByCriterionId = new Map(criteriaWithHashes.map(c => [c.id, c._criterion_hash]));
      const resultsToUpsert = freshResults.map(result => ({
        evaluation_id: evaluation.id,
        criterion_id: result.criterion_id,
        result: result.result,
        confidence: result.confidence,
        reasoning: result.reasoning,
        source: result.source,
        criterion_hash: hashByCriterionId.get(result.criterion_id) || null,
        context_hash: contextHash,
      }));

      const { error: upsertError } = await supabase
        .from('criterion_results')
        .upsert(resultsToUpsert, { onConflict: 'evaluation_id,criterion_id' });

      if (upsertError) console.error('Error batch upserting results:', upsertError);
    }

    // Ensure cached results are also linked to THIS evaluation (rebind to current evaluation_id)
    if (cachedResults.length > 0) {
      const hashByCriterionId = new Map(criteriaWithHashes.map(c => [c.id, c._criterion_hash]));
      const cachedToUpsert = cachedResults.map(r => ({
        evaluation_id: evaluation.id,
        criterion_id: r.criterion_id,
        result: r.result,
        confidence: r.confidence,
        reasoning: r.reasoning,
        source: r.source,
        criterion_hash: hashByCriterionId.get(r.criterion_id) || null,
        context_hash: contextHash,
      }));
      await supabase
        .from('criterion_results')
        .upsert(cachedToUpsert, { onConflict: 'evaluation_id,criterion_id' });
    }

    const allResults = [...cachedResults, ...freshResults];

    await supabase
      .from('candidate_evaluations')
      .update({ status: 'completed', evaluated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', evaluation.id);

    console.log(`Evaluation completed for candidate ${applicant_id} — ${allResults.length} results (${cachedResults.length} cached, ${freshResults.length} fresh)`);

    // ─── OBSERVABILITY: log usage (best-effort, non-blocking) ───────
    try {
      await supabase.from('ai_usage_log').insert({
        function_name: 'evaluate-candidate',
        user_id: callerId,
        employer_id: job.employer_id ?? null,
        organization_id: job.organization_id ?? null,
        job_id,
        applicant_id,
        criteria_count: criteria.length,
        cache_hits: cachedResults.length,
        fresh_calls: freshResults.length,
        duration_ms: Date.now() - evalStartMs,
        model: freshResults.length > 0 ? 'google/gemini-3.6-flash' : null,
        metadata: {
          semantic_cache_hits: semanticHits,
          prompt_version: PROMPT_VERSION,
        },
      });
    } catch (logErr) {
      console.warn('ai_usage_log insert failed (non-blocking):', logErr);
    }

    return new Response(
      JSON.stringify({ success: true, evaluation_id: evaluation.id, criteria_results: allResults, cache_hits: cachedResults.length, ai_calls: freshResults.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in evaluate-candidate:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ─── SHA-256 helper (Web Crypto, works in Deno edge) ────────────
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Video CV Analysis ──────────────────────────────────────────

async function analyzeVideoCV(
  supabase: any,
  apiKey: string,
  videoPath: string
): Promise<string | null> {
  console.log('Analyzing video CV');

  // Normalisera bort ev. legacy-prefix/URL och peka på rätt bucket.
  // Video-CV:n ligger i 'job-applications' — den gamla 'profile-media'-bucketen finns inte längre.
  let cleanPath = videoPath.trim();
  const legacyMatch = cleanPath.match(
    /\/storage\/v1\/object\/(?:public|sign)\/(?:profile-media|job-applications)\/(.+?)(?:\?|$)/
  );
  if (legacyMatch) cleanPath = decodeURIComponent(legacyMatch[1]);
  cleanPath = cleanPath.replace(/^(?:profile-media|job-applications)\//, '');

  // Get signed URL for the video
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('job-applications')
    .createSignedUrl(cleanPath, 300);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error('Failed to get signed URL for video CV:', signedUrlError?.message ?? 'unknown error');
    return null;
  }


  // Download video (limited to 10MB to avoid memory issues)
  const videoController = new AbortController();
  const videoTimeoutId = setTimeout(() => videoController.abort(), 30000); // 30s timeout
  const videoResponse = await fetch(signedUrlData.signedUrl, { signal: videoController.signal });
  clearTimeout(videoTimeoutId);
  if (!videoResponse.ok) {
    console.error('Failed to download video:', videoResponse.status);
    return null;
  }

  const contentLength = parseInt(videoResponse.headers.get('content-length') || '0');
  if (contentLength > 10 * 1024 * 1024) {
    console.log('Video too large for analysis (>10MB), skipping');
    return 'Video-CV finns men är för stor för automatisk analys.';
  }

  const buffer = await videoResponse.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // Convert to base64 for Gemini
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64Video = btoa(binary);

  const contentType = videoResponse.headers.get('content-type') || 'video/mp4';

  // Use Gemini (supports video natively)
  const response = await fetchWithRetry(
    'https://ai.gateway.lovable.dev/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Du analyserar en video-CV/videopresentation från en jobbsökande.
Sammanfatta vad personen säger om sig själv, sin erfarenhet, kompetenser och motivation.
Skriv en kortfattad sammanfattning (max 200 ord) på svenska.
Inkludera konkreta detaljer som nämns (företagsnamn, roller, utbildning, färdigheter).
Om videon inte innehåller relevant information för rekrytering, skriv det.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analysera denna video-CV och sammanfatta kandidatens presentation.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${contentType};base64,${base64Video}`,
                },
              },
            ],
          },
        ],
        temperature: 0.3,
      }),
    },
    2,
    1000
  );

  if (!response.ok) {
    console.error('Video analysis AI error:', response.status);
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (content) {
    console.log(`Video CV analyzed: ${content.length} chars`);
    return content;
  }

  return null;
}

// ─── AI-powered discrimination check ────────────────────────────

async function checkDiscriminationWithAI(
  apiKey: string,
  title: string,
  prompt: string
): Promise<{ isDiscriminatory: boolean; reason?: string }> {
  try {
    const response = await fetchWithRetry(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.5-flash',
          messages: [
            {
              role: 'system',
              content: `Du är en juridisk expert på svensk diskrimineringslag (2008:567).
Avgör om ett urvalskriterium för rekrytering strider mot diskrimineringslagen.

DISKRIMINERINGSGRUNDER (förbjudna):
1. Kön  2. Könsöverskridande identitet  3. Etnisk tillhörighet
4. Religion  5. Funktionsnedsättning  6. Sexuell läggning  7. Ålder

TILLÅTET: Erfarenhet, utbildning, certifikat, språkkunskaper, körkort, arbetstider, fysisk kapacitet (om sakligt motiverat).
"Bakgrund inom X" (yrkesmässig) — INTE diskriminerande.

Svara ENDAST JSON: { "isDiscriminatory": true/false, "reason": "förklaring eller null" }`,
            },
            {
              role: 'user',
              content: `Kriterietitel: ${title}\nKriterieinstruktion: ${prompt}`,
            },
          ],
          temperature: 0.1,
        }),
      },
      2, 500
    );

    if (!response.ok) return { isDiscriminatory: false };

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { isDiscriminatory: false };

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { isDiscriminatory: parsed.isDiscriminatory === true, reason: parsed.reason || undefined };
    }
    return { isDiscriminatory: false };
  } catch (err) {
    console.error('Discrimination check error:', err);
    return { isDiscriminatory: false };
  }
}

// ─── Context builders ────────────────────────────────────────────

function buildCandidateContext(
  application: any,
  profile: any,
  questions: any[],
  cvSummary: any,
  profileCv: any,
  videoAnalysis: string | null
): string {
  let context = '=== KANDIDATINFORMATION ===\n\n';

  // Profile
  if (profile) {
    context += '--- Profil ---\n';
    if (profile.first_name || profile.last_name) context += `Namn: ${profile.first_name || ''} ${profile.last_name || ''}\n`;
    if (profile.occupation) context += `Yrke: ${profile.occupation}\n`;
    if (profile.bio) context += `Om mig: ${profile.bio}\n`;
    if (profile.location) context += `Plats: ${profile.location}\n`;
    if (profile.city) context += `Stad: ${profile.city}\n`;
    if (profile.availability) context += `Tillgänglighet: ${profile.availability}\n`;
    if (profile.work_schedule) context += `Arbetstider: ${profile.work_schedule}\n`;
    if (profile.employment_type) context += `Anställningstyp: ${profile.employment_type}\n`;
    context += '\n';
  }

  // Application
  if (application) {
    context += '--- Ansökan ---\n';
    if (application.cover_letter) context += `Personligt brev: ${application.cover_letter}\n`;
    if (application.employment_status) context += `Anställningsstatus: ${application.employment_status}\n`;
    if (application.availability) context += `Tillgänglighet: ${application.availability}\n`;
    if (application.work_schedule) context += `Önskade arbetstider: ${application.work_schedule}\n`;
    
    if (application.custom_answers && typeof application.custom_answers === 'object') {
      context += '\n--- Svar på jobbfrågor ---\n';
      for (const [questionId, answer] of Object.entries(application.custom_answers)) {
        const question = questions?.find((q: any) => q.id === questionId);
        if (question) {
          context += `Fråga: ${question.question_text}\nSvar: ${answer}\n\n`;
        }
      }
    }
    context += '\n';
  }

  // CV — prioritize raw text, fallback to summary
  const summary = cvSummary || profileCv;
  if (summary) {
    const rawText = summary.raw_text;
    
    if (summary.is_valid_cv === false) {
      context += '--- CV-analys ---\n';
      context += `Dokumentstatus: Inget giltigt CV (${summary.document_type || 'okänt dokument'})\n`;
      context += 'OBS: Kandidaten har inte laddat upp ett giltigt CV.\n\n';
    } else if (rawText) {
      // Use raw CV text for maximum precision
      context += '--- CV (fulltext) ---\n';
      const maxChars = 12000;
      context += rawText.length > maxChars
        ? rawText.substring(0, maxChars) + '\n[CV-text trunkerad]\n'
        : rawText;
      context += '\n\n';
    } else if (summary.summary_text) {
      // Fallback to AI summary
      context += '--- CV-analys (sammanfattning) ---\n';
      context += `${summary.summary_text}\n`;
      if (summary.key_points && Array.isArray(summary.key_points)) {
        for (const point of summary.key_points) {
          const text = typeof point === 'string' ? point : point?.text;
          if (text && !text.startsWith('Dokumenttyp:')) context += `  • ${text}\n`;
        }
      }
      context += '\n';
    }
  } else {
    context += '--- CV ---\nInget CV har analyserats.\n\n';
  }

  // Video CV analysis
  if (videoAnalysis) {
    context += '--- Video-CV (transkriberad analys) ---\n';
    context += videoAnalysis;
    context += '\n\n';
  }

  return context;
}

function buildJobContext(job: any, criteria: any[], questions: any[]): string {
  let context = '=== JOBBINFORMATION ===\n\n';
  context += `Jobbtitel: ${job.title}\n`;
  if (job.description) context += `Beskrivning: ${job.description}\n`;
  if (job.requirements) context += `Krav: ${job.requirements}\n`;
  if (job.occupation) context += `Yrkeskategori: ${job.occupation}\n`;
  if (job.employment_type) context += `Anställningstyp: ${job.employment_type}\n`;
  if (job.work_schedule) context += `Arbetstider: ${job.work_schedule}\n`;
  if (job.location) context += `Plats: ${job.location}\n`;
  
  if (questions?.length > 0) {
    context += '\n--- Jobbfrågor ---\n';
    for (const q of questions) context += `- ${q.question_text}\n`;
  }

  if (criteria?.length > 0) {
    context += '\n--- Urvalskriterier att utvärdera ---\n';
    for (const c of criteria) context += `- [criterion_id: ${c.id}] ${c.title}: ${c.prompt}\n`;
  }

  return context;
}

// ─── Feedback context (few-shot learning) ─────────────────────────

function buildFeedbackContext(feedback: any[], criteria: any[]): string {
  if (!feedback || feedback.length === 0) return '';

  // Group by criterion_id
  const bycriterion: Record<string, any[]> = {};
  for (const f of feedback) {
    if (!bycriterion[f.criterion_id]) bycriterion[f.criterion_id] = [];
    bycriterion[f.criterion_id].push(f);
  }

  const criteriaMap = new Map(criteria.map(c => [c.id, c.title]));
  
  let context = '\n=== REKRYTERARENS TIDIGARE KORRIGERINGAR ===\n';
  context += '(Använd dessa som vägledning för din bedömning. Rekryteraren har rättat AI:ns resultat i dessa fall.)\n\n';

  for (const [criterionId, corrections] of Object.entries(bycriterion)) {
    const title = criteriaMap.get(criterionId);
    if (!title) continue;

    context += `Kriterium: "${title}"\n`;
    for (const c of corrections.slice(0, 3)) { // Max 3 examples per criterion
      context += `  AI sa: ${c.ai_result} → Rekryteraren rättade till: ${c.corrected_result}`;
      if (c.recruiter_note) context += ` (Anteckning: ${c.recruiter_note})`;
      context += '\n';
    }
    context += '\n';
  }

  return context;
}

// Per-criterion feedback digest — used inside criterion_hash so a correction
// on ONE criterion only invalidates that criterion's cache, not the whole
// candidate. Deterministic (sorted) so identical feedback → identical hash.
function buildFeedbackByCriterion(feedback: any[], criteria: any[]): Map<string, string> {
  const map = new Map<string, string>();
  if (!feedback || feedback.length === 0) return map;

  const byCriterion: Record<string, any[]> = {};
  for (const f of feedback) {
    if (!f.criterion_id) continue;
    (byCriterion[f.criterion_id] ||= []).push(f);
  }

  for (const c of criteria) {
    const rows = byCriterion[c.id];
    if (!rows || rows.length === 0) continue;
    const sorted = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const digest = sorted
      .slice(0, 5)
      .map(r => `${r.ai_result}>${r.corrected_result}|${(r.recruiter_note || '').trim()}`)
      .join(';;');
    map.set(c.id, digest);
  }
  return map;
}

// ─── AI evaluation with tool calling ─────────────────────────────

async function callLovableAI(
  apiKey: string,
  jobContext: string,
  candidateContext: string,
  criteria: any[],
  feedbackContext: string,
  includeSummary: boolean = false,
): Promise<EvaluationResponse | null> {
  try {
    // Auktoritativt synonymlexikon för just dessa kriterier (garanterat säkerhetsnät
    // istället för att lita enbart på modellens allmänbildning).
    const aliasBlock = buildAliasPromptBlock(
      (criteria || []).flatMap((c: any) => [c?.title, c?.prompt].filter(Boolean)),
    );

    const systemPrompt = `Du är en professionell svensk rekryteringsassistent som utvärderar kandidater mot urvalskriterier.

═══════════════════════════════════════════════════
🧠 SEMANTISK FÖRSTÅELSE — DETTA ÄR AVGÖRANDE
═══════════════════════════════════════════════════
Du MÅSTE förstå att olika ord kan betyda EXAKT SAMMA sak. Rekryteraren skriver kriterier på vardagligt svenska — kandidater skriver på sitt eget sätt. Din uppgift är att koppla ihop dem intelligent.

Exempel på vad du MÅSTE förstå som EKVIVALENT:

📄 KÖRKORT
- "B-kort" = "B-körkort" = "körkort B" = "har körkort" (i Sverige = B som standard) = "personbilskörkort"
- "C-kort" = "lastbilskörkort" = "tungt körkort"
- "CE" = "släpvagnskörkort tung" = "truck+släp"
- "YKB" = "yrkeskompetensbevis"
- "ADR" = "farligt gods-behörighet"

💻 IT / TEKNIK
- "React" ≈ "React.js" ≈ "ReactJS"
- "JS" = "JavaScript" ; "TS" = "TypeScript"
- "SEO" = "sökmotoroptimering"
- "UX" = "användarupplevelse" ; "UI" = "gränssnittsdesign"
- "DevOps" ≈ "CI/CD" ≈ "infrastruktur"
- "backend" ≈ "server-side" ; "frontend" ≈ "klient" ≈ "webbutveckling"
- "Kubernetes" = "k8s"

🩺 VÅRD
- "USK" = "undersköterska"
- "SSK" = "sjuksköterska"
- "leg." = "legitimerad"
- "HLR" = "hjärt-lungräddning"
- "delegering" = "delegerad sjukvård"

🏗️ BYGG / INDUSTRI
- "heta arbeten" = "certifikat heta arbeten"
- "ställningsbygg" = "ställningsbyggnadskurs"
- "liftkort" = "mobil arbetsplattform"
- "truckkort" = "truckförarintyg" (A, B, C = olika klasser)

🎓 UTBILDNING
- "gymnasium" = "gymnasieutbildning" = "gymnasieexamen"
- "högskola" ≈ "universitet"
- "YH" = "yrkeshögskola"
- "civilingenjör" ≈ "MSc" ; "kandidat" ≈ "BSc"

🗣️ SPRÅK
- "flytande svenska" = "modersmål svenska" = "obehindrad svenska"
- "engelska i tal och skrift" = "professionell engelska"
- "nybörjare" ≠ "flytande" — bedöm NIVÅ, inte bara närvaro

⏰ TILLGÄNGLIGHET
- "kan jobba helger" = "flexibel arbetstid" = "OB-villig"
- "skiftarbete" = "roterande arbetstider" = "3-skift"
- "heltid" = "100%" ; "deltid" = "<100%"

📅 ERFARENHET (viktigt — räkna år konkret!)
- "2+ års erfarenhet" → räkna faktiska år från CV:s tjänstgöringsperioder
- "junior" ≈ 0-2 år ; "senior" ≈ 5+ år
- Om CV visar 2019-2024 = ~5 år
${aliasBlock}


═══════════════════════════════════════════════════
📋 BEDÖMNINGSREGLER
═══════════════════════════════════════════════════
- "match" = Konkret bevis finns (i CV, svar, profil eller video)
- "no_match" = Bevis saknas ELLER motsägs
- Confidence 0.0–1.0 (hur säker är du?)
- Source: "cv", "application", "profile", "answer", "video", "multiple"
- Reasoning: EN kort mening på svenska som förklarar KONKRET vad du hittade (t.ex. "Kandidaten skrev 'har körkort' i svaret — motsvarar B-körkort")

═══════════════════════════════════════════════════
⚖️ TÄNK SÅHÄR
═══════════════════════════════════════════════════
1. Läs kriteriet — VAD frågar rekryteraren egentligen efter?
2. Sök i ALL kandidatdata (CV, svar, profil, video) — men förstå synonymer!
3. Om kandidaten skrev "har körkort" och kriteriet är "B-körkort" → MATCH (i Sverige är B standard)
4. Om osäker: hellre no_match med låg confidence än en falsk match
5. Rekryterarens tidigare korrigeringar är GOLDEN — följ deras mönster

VIKTIGT:
- Läs CV-fulltext noggrant för år, arbetsgivare, certifikat
- Räkna faktiska år vid erfarenhetskrav
- Saknad information ≠ negativ information — men båda ger no_match
- Var STRIKT vid diskvalificerande krav (t.ex. certifikat), MJUKARE vid nice-to-haves

═══════════════════════════════════════════════════
🔎 BEVISKÄLLA — VAD RÄKNAS SOM BEVIS
═══════════════════════════════════════════════════
Ett ord som bara FÖREKOMMER i ett dokument är INTE bevis. Fråga dig alltid: säger kandidaten att hen har detta, eller nämns ordet bara?

GILTIGT bevis (→ kan ge "match"):
1. Tjänsteperiod/arbetsgivare i CV:t där uppgiften ingår ("Ekonomiassistent, 2019–2023 — bokslut och årsredovisning").
2. Kandidatens egen beskrivning i fritext, personligt brev, "om mig", svar på frågor eller video ("Jag har arbetat med årsredovisning i tre år").
3. Kandidatens egen uppräkning av kompetenser/styrkor — punktlistor räknas ("Mina styrkor: bokslut, årsredovisning, moms") även utan årtal. Sätt då lite lägre confidence (~0.6–0.75).
4. Certifikat/intyg/utbildning som styrker kravet.

INTE bevis (→ "no_match"):
- Ordet förekommer bara i ett uppladdat dokument som inte handlar om kandidatens egen erfarenhet (t.ex. en bifogad årsredovisning för en bostadsrättsförening, en arbetsgivares broschyr, en mall eller ett exempeldokument). Att dokumentet HETER "årsredovisning" bevisar inte att kandidaten arbetat med årsredovisningar.
- Ordet nämns om någon annan person, om ett företag eller i en jobbannonstext.

🚫 NEGATIONER — MYCKET VIKTIGT
Om kandidaten uttryckligen förnekar kravet ska det ALLTID bli "no_match" med hög confidence, aldrig "match".
Exempel som betyder NEJ: "Jag har inte jobbat med årsredovisning", "ingen erfarenhet av X", "har aldrig arbetat med X", "saknar X", "har inte B-körkort", "ej truckkort", "inga kunskaper i X", "bara läst om X men aldrig använt det", "planerar att lära mig X", "vill lära mig X".
Läs alltid hela meningen runt ordet innan du bedömer — nekande formuleringar får aldrig läsas som träff. Skriv i reasoning att kandidaten uttryckligen anger att hen saknar detta.`;

    const summaryInstruction = includeSummary
      ? `\n\nBonus: Skriv även en kort professionell sammanfattning (2–4 meningar på svenska) av kandidatens profil samt 3–6 nyckelpunkter (kort text + typ: strength|experience|skill|note).`
      : '';
    const userPrompt = `${jobContext}\n\n${candidateContext}${feedbackContext}\n\nUtvärdera kandidaten mot varje urvalskriterium.${summaryInstruction}`;

    const response = await fetchWithRetry(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.6-flash',

          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'submit_evaluation',
                description: 'Submit the evaluation results for all criteria',
                parameters: {
                  type: 'object',
                  properties: {
                    criteria_results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          criterion_id: { type: 'string', description: 'UUID of the criterion' },
                          title: { type: 'string', description: 'Title of the criterion' },
                          result: { type: 'string', enum: ['match', 'no_match'] },
                          confidence: { type: 'number', description: '0.0 to 1.0' },
                          reasoning: { type: 'string', description: 'Short explanation in Swedish' },
                          source: { type: 'string', enum: ['cv', 'application', 'profile', 'answer', 'video', 'multiple'] },
                        },
                        required: ['criterion_id', 'title', 'result', 'confidence', 'reasoning', 'source'],
                        additionalProperties: false,
                      },
                    },
                    summary_text: includeSummary ? { type: 'string', description: 'Kort sammanfattning på svenska (2-4 meningar)' } : undefined,
                    key_points: includeSummary ? {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          text: { type: 'string' },
                          type: { type: 'string', enum: ['strength', 'experience', 'skill', 'note'] },
                        },
                        required: ['text'],
                      },
                    } : undefined,
                  },
                  required: includeSummary ? ['criteria_results', 'summary_text', 'key_points'] : ['criteria_results'],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: 'function', function: { name: 'submit_evaluation' } },
          temperature: 0.2,
        }),
      },
      3,
      1000
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      // Terminala gateway-statusar måste bubbla upp med rätt status så att
      // kö-workern kan bryta kedjan (402 = slut på krediter, 403 = blockerad,
      // 429 = rate limit) istället för att mala vidare på ett generiskt 500.
      if ([402, 403, 429].includes(response.status)) {
        throw new GatewayError(response.status, errorText);
      }
      return null;
    }


    const data = await response.json();
    
    // Extract from tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        
        const validIds = new Set(criteria.map(c => c.id));
        const rawResults = parsed.criteria_results || [];
        
        console.log(`AI returned ${rawResults.length} raw results, valid criterion IDs: ${[...validIds].join(', ')}`);
        
        // Try to match by criterion_id first, then fallback to matching by title
        const validResults: any[] = [];
        for (const r of rawResults) {
          if (validIds.has(r.criterion_id) && ['match', 'no_match'].includes(r.result)) {
            validResults.push(r);
          } else {
            // Fallback: match by title if criterion_id doesn't match
            const matchedCriterion = criteria.find(
              (c: any) => c.title.toLowerCase() === (r.title || '').toLowerCase()
            );
            if (matchedCriterion && ['match', 'no_match'].includes(r.result)) {
              console.log(`Matched criterion by title "${r.title}" → ${matchedCriterion.id}`);
              validResults.push({ ...r, criterion_id: matchedCriterion.id });
            } else {
              console.log(`Discarded AI result: criterion_id=${r.criterion_id}, title=${r.title}, result=${r.result}`);
            }
          }
        }

        return {
          criteria_results: validResults,
          summary_text: typeof parsed.summary_text === 'string' ? parsed.summary_text : undefined,
          key_points: Array.isArray(parsed.key_points) ? parsed.key_points : undefined,
        };
      } catch (parseError) {
        console.error('Failed to parse tool call:', parseError);
      }
    }

    // Fallback: regular content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } catch { /* ignore */ }
    }

    return null;
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    console.error('Error calling AI:', error);

    return null;
  }
}
