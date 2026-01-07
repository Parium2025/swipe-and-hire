import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Discrimination keywords to check for in criteria
const DISCRIMINATION_KEYWORDS = {
  age: ['ålder', 'år gammal', 'under 30', 'över 40', 'ung', 'gammal', 'pensionär', 'senior'],
  gender: ['kön', 'man', 'kvinna', 'manlig', 'kvinnlig', 'tjej', 'kille', 'herre', 'dam'],
  ethnicity: ['etnicitet', 'ras', 'hudfärg', 'svensk', 'invandrare', 'utländsk', 'bakgrund'],
  religion: ['religion', 'muslim', 'kristen', 'jude', 'hindu', 'buddhist', 'troende'],
  disability: ['funktionsnedsättning', 'handikapp', 'funktionshinder', 'rullstol'],
  sexual_orientation: ['sexuell läggning', 'homosexuell', 'heterosexuell', 'bisexuell', 'gay', 'lesbisk'],
  pregnancy: ['graviditet', 'gravid', 'föräldraledig', 'mamma', 'pappa', 'barn'],
};

function checkForDiscrimination(prompt: string): { isDiscriminatory: boolean; reason?: string } {
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [category, keywords] of Object.entries(DISCRIMINATION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        const categoryNames: Record<string, string> = {
          age: 'Åldersdiskriminering',
          gender: 'Könsdiskriminering',
          ethnicity: 'Etnisk diskriminering',
          religion: 'Religiös diskriminering',
          disability: 'Diskriminering av funktionsnedsättning',
          sexual_orientation: 'Diskriminering av sexuell läggning',
          pregnancy: 'Diskriminering relaterad till graviditet/föräldraskap',
        };
        return {
          isDiscriminatory: true,
          reason: `${categoryNames[category]} är inte tillåtet enligt diskrimineringslagen. Kriterier ska baseras på kompetens och kvalifikationer.`,
        };
      }
    }
  }
  
  return { isDiscriminatory: false };
}

interface CriterionResult {
  criterion_id: string;
  title: string;
  result: 'match' | 'no_match' | 'no_data';
  confidence: number;
  reasoning: string;
  source: string;
}

interface EvaluationResponse {
  criteria_results: CriterionResult[];
  summary: {
    text: string;
    key_points: Array<{
      text: string;
      type: 'positive' | 'negative' | 'neutral';
    }>;
  };
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
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Action: validate_criterion - Check if a criterion is discriminatory
    if (action === 'validate_criterion') {
      const { prompt } = await req.json();
      const check = checkForDiscrimination(prompt);
      return new Response(JSON.stringify(check), {
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

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch criteria for this job
    const { data: criteria, error: criteriaError } = await supabase
      .from('job_criteria')
      .select('*')
      .eq('job_id', job_id)
      .eq('is_active', true)
      .order('order_index');

    if (criteriaError) {
      console.error('Error fetching criteria:', criteriaError);
    }

    // Fetch job questions
    const { data: questions, error: questionsError } = await supabase
      .from('job_questions')
      .select('*')
      .eq('job_id', job_id)
      .order('order_index');

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
    }

    // Fetch application details
    const { data: application, error: applicationError } = await supabase
      .from('job_applications')
      .select('*')
      .eq('job_id', job_id)
      .eq('applicant_id', applicant_id)
      .single();

    if (applicationError) {
      console.error('Error fetching application:', applicationError);
    }

    // Fetch applicant profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', applicant_id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    // Build context for AI
    const candidateContext = buildCandidateContext(application, profile, questions);
    const jobContext = buildJobContext(job, criteria || [], questions || []);

    // Create or update evaluation record
    const { data: evaluation, error: evalError } = await supabase
      .from('candidate_evaluations')
      .upsert({
        job_id,
        applicant_id,
        application_id: application?.id,
        status: 'processing',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'job_id,applicant_id',
      })
      .select()
      .single();

    if (evalError) {
      console.error('Error creating evaluation:', evalError);
      return new Response(
        JSON.stringify({ error: 'Failed to create evaluation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Lovable AI for evaluation
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await callLovableAI(LOVABLE_API_KEY, jobContext, candidateContext, criteria || []);

    if (!aiResponse) {
      // Update evaluation as failed
      await supabase
        .from('candidate_evaluations')
        .update({
          status: 'failed',
          error_message: 'AI evaluation failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', evaluation.id);

      return new Response(
        JSON.stringify({ error: 'AI evaluation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save criterion results
    if (aiResponse.criteria_results && aiResponse.criteria_results.length > 0) {
      for (const result of aiResponse.criteria_results) {
        await supabase
          .from('criterion_results')
          .upsert({
            evaluation_id: evaluation.id,
            criterion_id: result.criterion_id,
            result: result.result,
            confidence: result.confidence,
            reasoning: result.reasoning,
            source: result.source,
          }, {
            onConflict: 'evaluation_id,criterion_id',
          });
      }
    }

    // NOTE: Summary is NOT saved here - CV summary is handled by generate-cv-summary
    // This function ONLY handles criteria evaluation results

    // Update evaluation as completed
    await supabase
      .from('candidate_evaluations')
      .update({
        status: 'completed',
        evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', evaluation.id);

    console.log(`Evaluation completed for candidate ${applicant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        evaluation_id: evaluation.id,
        criteria_results: aiResponse.criteria_results,
        summary: aiResponse.summary,
      }),
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

function buildCandidateContext(application: any, profile: any, questions: any[]): string {
  let context = '=== KANDIDATINFORMATION ===\n\n';

  // Profile info
  if (profile) {
    context += '--- Profil ---\n';
    if (profile.first_name || profile.last_name) {
      context += `Namn: ${profile.first_name || ''} ${profile.last_name || ''}\n`;
    }
    if (profile.occupation) context += `Yrke: ${profile.occupation}\n`;
    if (profile.bio) context += `Om mig: ${profile.bio}\n`;
    if (profile.location) context += `Plats: ${profile.location}\n`;
    if (profile.city) context += `Stad: ${profile.city}\n`;
    if (profile.availability) context += `Tillgänglighet: ${profile.availability}\n`;
    if (profile.work_schedule) context += `Arbetstider: ${profile.work_schedule}\n`;
    if (profile.employment_type) context += `Anställningstyp: ${profile.employment_type}\n`;
    context += '\n';
  }

  // Application info
  if (application) {
    context += '--- Ansökan ---\n';
    if (application.cover_letter) context += `Personligt brev: ${application.cover_letter}\n`;
    if (application.employment_status) context += `Anställningsstatus: ${application.employment_status}\n`;
    if (application.availability) context += `Tillgänglighet: ${application.availability}\n`;
    if (application.work_schedule) context += `Önskade arbetstider: ${application.work_schedule}\n`;
    
    // Custom answers
    if (application.custom_answers && typeof application.custom_answers === 'object') {
      context += '\n--- Svar på jobbfrågor ---\n';
      for (const [questionId, answer] of Object.entries(application.custom_answers)) {
        const question = questions?.find((q: any) => q.id === questionId);
        if (question) {
          context += `Fråga: ${question.question_text}\n`;
          context += `Svar: ${answer}\n\n`;
        }
      }
    }
    context += '\n';
  }

  // CV info (if available as text)
  if (application?.cv_url) {
    context += '--- CV ---\n';
    context += `CV finns uppladdad: ${application.cv_url}\n`;
    context += '(CV-text är inte tillgänglig för analys i denna version)\n\n';
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
  
  if (questions && questions.length > 0) {
    context += '\n--- Jobbfrågor som ställs ---\n';
    for (const q of questions) {
      context += `- ${q.question_text}\n`;
    }
  }

  if (criteria && criteria.length > 0) {
    context += '\n--- Urvalskriterier att utvärdera ---\n';
    for (const c of criteria) {
      context += `- ${c.title}: ${c.prompt}\n`;
    }
  }

  return context;
}

async function callLovableAI(
  apiKey: string,
  jobContext: string,
  candidateContext: string,
  criteria: any[]
): Promise<EvaluationResponse | null> {
  try {
    // IMPORTANT: Summary and criteria evaluation are SEPARATE
    // Summary = independent CV/profile analysis (like Teamtailor Co-pilot)
    // Criteria = yes/no matching for quick filtering on Kanban cards
    
    // This function ONLY evaluates criteria - CV summary is handled separately by generate-cv-summary
    const systemPrompt = `Du är en professionell rekryteringsassistent som ENDAST utvärderar urvalskriterier.

DIN ENDA UPPGIFT: Utvärdera varje urvalskriterium och ge resultat:
- "match" (✅) = konkret bevis hittades att kandidaten uppfyller kriteriet
- "no_match" (❌) = bevis för motsatsen eller tydligt saknas

VIKTIGT: Om du inte hittar information för ett kriterium, sätt result till "no_match" (inte "no_data").

SVAR FORMAT (giltig JSON):
{
  "criteria_results": [
    {
      "criterion_id": "uuid",
      "title": "Kriteriets titel", 
      "result": "match" | "no_match",
      "confidence": 0.0-1.0,
      "reasoning": "Kort förklaring på svenska",
      "source": "profile" | "application" | "answer" | "cv"
    }
  ]
}

REGLER:
- Svara ENDAST med JSON
- Utvärdera ENDAST de kriterier som anges
- Var strikt - om information saknas = no_match
- Skriv korta resonemang (max 1 mening)`;

    const userPrompt = `${jobContext}\n\n${candidateContext}\n\nUtvärdera urvalskriterierna nedan. Svara ENDAST med JSON.`;

    // Add criteria info for the response (if any exist)
    const criteriaInfo = criteria.map(c => ({
      criterion_id: c.id,
      title: c.title,
      prompt: c.prompt,
    }));

    // If no criteria, return early - nothing to evaluate
    if (criteria.length === 0) {
      return { criteria_results: [] };
    }

    const criteriaSection = `\n\nKriterier att utvärdera:\n${JSON.stringify(criteriaInfo, null, 2)}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: userPrompt + criteriaSection
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        console.error('Rate limit exceeded');
      }
      if (response.status === 402) {
        console.error('Payment required');
      }
      
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return null;
    }

    // Parse the JSON response
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return null;
    }

  } catch (error) {
    console.error('Error calling Lovable AI:', error);
    return null;
  }
}
