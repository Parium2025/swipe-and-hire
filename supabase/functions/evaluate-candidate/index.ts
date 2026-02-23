import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
}

// Retry with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
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
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.log(`Attempt ${attempt + 1} network error, retrying in ${Math.round(delay)}ms...`);
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
    const body = await req.json();
    const job_id = body.job_id || body.jobId;
    const applicant_id = body.applicant_id || body.applicantId;
    const application_id = body.application_id || body.applicationId;
    const action = body.action;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Call AI with tool calling
    const aiResponse = await callLovableAI(LOVABLE_API_KEY, jobContext, candidateContext, criteria, feedbackContext);

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

    // Batch upsert criterion results
    if (aiResponse.criteria_results.length > 0) {
      const resultsToUpsert = aiResponse.criteria_results.map(result => ({
        evaluation_id: evaluation.id,
        criterion_id: result.criterion_id,
        result: result.result,
        confidence: result.confidence,
        reasoning: result.reasoning,
        source: result.source,
      }));

      const { error: upsertError } = await supabase
        .from('criterion_results')
        .upsert(resultsToUpsert, { onConflict: 'evaluation_id,criterion_id' });

      if (upsertError) console.error('Error batch upserting results:', upsertError);
    }

    await supabase
      .from('candidate_evaluations')
      .update({ status: 'completed', evaluated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', evaluation.id);

    console.log(`Evaluation completed for candidate ${applicant_id} — ${aiResponse.criteria_results.length} criteria evaluated`);

    return new Response(
      JSON.stringify({ success: true, evaluation_id: evaluation.id, criteria_results: aiResponse.criteria_results }),
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

// ─── Video CV Analysis ──────────────────────────────────────────

async function analyzeVideoCV(
  supabase: any,
  apiKey: string,
  videoPath: string
): Promise<string | null> {
  console.log('Analyzing video CV:', videoPath);

  // Get signed URL for the video
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('profile-media')
    .createSignedUrl(videoPath, 300);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error('Failed to get signed URL for video:', signedUrlError);
    return null;
  }

  // Download video (limited to 10MB to avoid memory issues)
  const videoResponse = await fetch(signedUrlData.signedUrl);
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
          model: 'google/gemini-2.5-flash-lite',
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
    for (const c of criteria) context += `- ${c.title}: ${c.prompt}\n`;
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

// ─── AI evaluation with tool calling ─────────────────────────────

async function callLovableAI(
  apiKey: string,
  jobContext: string,
  candidateContext: string,
  criteria: any[],
  feedbackContext: string
): Promise<EvaluationResponse | null> {
  try {
    const systemPrompt = `Du är en professionell rekryteringsassistent som utvärderar kandidater mot specifika urvalskriterier.

DIN UPPGIFT: Utvärdera VARJE kriterium baserat på ALL tillgänglig information:
- Profilinformation (yrke, plats, tillgänglighet)
- Ansökningsdata (personligt brev, anställningsstatus)
- Svar på jobbfrågor (t.ex. körkort, erfarenhet)
- CV-fulltext (om tillgänglig — läs noggrant)
- Video-CV transkription (om tillgänglig)
- Rekryterarens tidigare korrigeringar (om tillgängliga — lär av dem!)

BEDÖMNINGSREGLER:
- "match" = Konkret bevis hittades
- "no_match" = Bevis saknas eller motsägs
- Confidence 0.0–1.0
- Source: "cv", "application", "profile", "answer", "video", "multiple"
- Reasoning: Max 1 mening på svenska

VIKTIGT:
- Om CV-fulltext finns, läs den noggrant för detaljer (år, arbetsgivare, certifikat)
- Om rekryteraren tidigare har korrigerat ditt resultat för ett kriterium, luta åt rekryterarens bedömning
- Saknad information = no_match med låg confidence
- Var strikt men rättvis`;

    const userPrompt = `${jobContext}\n\n${candidateContext}${feedbackContext}\n\nUtvärdera kandidaten mot varje urvalskriterium.`;

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
                  },
                  required: ['criteria_results'],
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
        const validResults = (parsed.criteria_results || []).filter(
          (r: any) => validIds.has(r.criterion_id) && ['match', 'no_match'].includes(r.result)
        );

        return { criteria_results: validResults };
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
    console.error('Error calling AI:', error);
    return null;
  }
}
