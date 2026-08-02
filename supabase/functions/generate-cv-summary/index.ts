import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";
import pdfParse from "npm:pdf-parse@1.1.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { applicant_id, application_id, job_id, proactive } = await req.json();
    // NOTE: cv_url_override intentionally removed — was an IDOR vector
    
    if (!applicant_id) {
      return new Response(
        JSON.stringify({ error: 'applicant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // proactive=true means this is a background pre-analysis when user uploads CV to their profile
    // Any call without a specific application/job is a profile-level (proactive) analysis.
    const isProactiveAnalysis = proactive === true || (!application_id && !job_id);
    console.log(`Generating CV summary for applicant ${applicant_id}${isProactiveAnalysis ? ' (PROACTIVE)' : ''}`);

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Detect service_role callers (internal invokes like process-cv-queue).
    // These bypass the per-user ownership check because they are trusted server-to-server.
    const rawToken = authHeader.replace('Bearer ', '').trim();
    const isServiceRole = rawToken === supabaseServiceKey;

    let callerId: string | null = null;
    if (!isServiceRole) {
      // Verify caller identity
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(rawToken);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if ((claimsData.claims as { role?: string }).role === 'service_role') {
        // signed service-role JWT — also trusted
      } else {
        callerId = claimsData.claims.sub as string;
      }
    }

    // === AUTHORIZATION: caller must be applicant OR employer with access to their application ===
    if (callerId !== null && callerId !== applicant_id) {
      // Employer path: must own a job the applicant has applied to
      let allowed = false;
      if (job_id) {
        const { data: job } = await supabase
          .from('job_postings')
          .select('employer_id, organization_id')
          .eq('id', job_id)
          .single();
        if (job) {
          if (job.employer_id === callerId) {
            allowed = true;
          } else if (job.organization_id) {
            const { data: sameOrg } = await supabase
              .from('profiles')
              .select('user_id')
              .eq('user_id', callerId)
              .eq('organization_id', job.organization_id)
              .maybeSingle();
            if (sameOrg) allowed = true;
          }
          // Also verify the applicant actually applied to this job
          if (allowed) {
            const { data: app } = await supabase
              .from('job_applications')
              .select('id')
              .eq('job_id', job_id)
              .eq('applicant_id', applicant_id)
              .maybeSingle();
            if (!app) allowed = false;
          }
        }
      }
      if (!allowed) {
        console.warn(`Unauthorized generate-cv-summary: caller=${callerId} applicant=${applicant_id} job=${job_id}`);
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    // For proactive analysis, check if we already have an up-to-date summary
    const cvUrl = profile?.cv_url;

    
    if (isProactiveAnalysis && cvUrl) {
      const { data: existingSummary } = await supabase
        .from('profile_cv_summaries')
        .select('cv_url, summary_text')
        .eq('user_id', applicant_id)
        .maybeSingle();

      // Skip only if the CV is unchanged AND the stored analysis actually succeeded.
      // (A previous failed run can leave a row with an empty summary — that must be retried.)
      if (existingSummary?.cv_url === cvUrl && (existingSummary?.summary_text || '').trim().length > 0) {
        console.log('CV unchanged, skipping proactive analysis');
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'CV unchanged' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch application if provided (not for proactive analysis)
    let application = null;
    if (!isProactiveAnalysis) {
      if (application_id) {
        const { data, error } = await supabase
          .from('job_applications')
          .select('*')
          .eq('id', application_id)
          .single();
        if (!error) application = data;
      } else if (job_id) {
        const { data, error } = await supabase
          .from('job_applications')
          .select('*')
          .eq('job_id', job_id)
          .eq('applicant_id', applicant_id)
          .single();
        if (!error) application = data;
      }
    }

    // Get CV URL - prioritize override, then application, then profile
    const finalCvUrl = application?.cv_url || profile?.cv_url;

    // ─── SHARED CACHE: reuse profile summary for job-specific analysis ───
    // If we already have a proactive profile summary for this exact CV, copy it
    // into candidate_summaries without any AI call. Saves ~100% of repeated cost
    // when the same candidate applies to multiple jobs with the same CV.
    if (!isProactiveAnalysis && finalCvUrl) {
      const { data: profileSummary } = await supabase
        .from('profile_cv_summaries')
        .select('summary_text, key_points, raw_text, is_valid_cv, document_type, cv_url')
        .eq('user_id', applicant_id)
        .maybeSingle();

      if (profileSummary && profileSummary.cv_url === finalCvUrl && profileSummary.summary_text) {
        console.log('Reusing profile CV summary (0 AI calls)');
        const saveJobId = job_id || application?.job_id;
        if (saveJobId) {
          await supabase
            .from('candidate_summaries')
            .upsert({
              job_id: saveJobId,
              applicant_id,
              application_id: application?.id || application_id,
              summary_text: profileSummary.summary_text,
              key_points: profileSummary.key_points,
              raw_text: profileSummary.raw_text,
              generated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'job_id,applicant_id' });
        }

        return new Response(
          JSON.stringify({
            success: true,
            reused: true,
            is_valid_cv: profileSummary.is_valid_cv !== false,
            document_type: profileSummary.document_type,
            summary: {
              summary_text: profileSummary.summary_text,
              key_points: profileSummary.key_points,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }



let contentType = '';
    let userContent: string | any[] | null = null;
    let rawExtractedText: string | null = null; // Store raw text for evaluate-candidate
    let needsVisionModel = false; // true when we send an image/scanned PDF instead of plain text

    if (finalCvUrl) {
      console.log('CV URL found', { hasCvUrl: !!finalCvUrl });

      try {
        // Get signed URL for the CV
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('job-applications')
          .createSignedUrl(finalCvUrl, 300); // 5 min expiry

        if (signedUrlError) {
          console.error('Error getting signed URL:', signedUrlError);
        } else if (signedUrlData?.signedUrl) {
          console.log('Got signed URL, downloading document...');

          const docController = new AbortController();
          const docTimeoutId = setTimeout(() => docController.abort(), 30000); // 30s timeout for document download
          const docResponse = await fetch(signedUrlData.signedUrl, { signal: docController.signal });
          clearTimeout(docTimeoutId);

          if (docResponse.ok) {
            contentType = docResponse.headers.get('content-type') || '';
            console.log('Document content type:', contentType);

            // For PDFs - extract text and send to AI
            if (contentType.includes('pdf')) {
              console.log('PDF detected - extracting text with pdf-parse...');
              
              try {
                const buffer = await docResponse.arrayBuffer();
                let extractedText = '';
                try {
                  const pdfData = await pdfParse(Buffer.from(buffer));
                  extractedText = pdfData.text?.trim() || '';
                } catch (parseErr) {
                  console.warn('pdf-parse failed, will use vision fallback:', parseErr);
                }

                if (!extractedText || extractedText.length < 50) {
                  // Scanned/image-based PDF: let the model read the document directly.
                  console.log('PDF text too short — sending PDF to AI as document (vision fallback)');
                  const bytes = new Uint8Array(buffer);
                  let binary = '';
                  const chunkSize = 0x8000;
                  for (let i = 0; i < bytes.length; i += chunkSize) {
                    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
                  }
                  const base64Pdf = btoa(binary);
                  needsVisionModel = true;
                  userContent = [
                    {
                      type: 'text',
                      text: 'Analysera dokumentet enligt instruktionerna och returnera ENDAST JSON.',
                    },
                    {
                      type: 'file',
                      file: {
                        filename: 'dokument.pdf',
                        file_data: `data:application/pdf;base64,${base64Pdf}`,
                      },
                    },
                  ];
                } else {
                  console.log(`PDF text extracted successfully: ${extractedText.length} chars`);
                  rawExtractedText = extractedText; // Save full raw text
                  // Truncate if too long (AI has token limits)
                  const maxChars = 15000;
                  userContent = extractedText.length > maxChars
                    ? extractedText.substring(0, maxChars) + '\n\n[Text trunkerad på grund av längd]'
                    : extractedText;
                }
                  
              } catch (pdfError) {
                console.error('PDF parsing error:', pdfError);
                // Fallback for corrupted/unreadable PDFs
                const pdfKeyPoints = [
                  { text: 'Dokumenttyp: Oläsbar PDF', type: 'negative', meta: { source_cv_url: finalCvUrl, content_type: contentType, analyzed_at: new Date().toISOString() } },
                  { text: 'Fel: Kunde inte läsa PDF-filen', type: 'negative' },
                  { text: 'Tips: Kontrollera att filen inte är skadad och ladda upp igen', type: 'neutral' }
                ];
                const pdfSummaryText = 'PDF-filen kunde inte läsas. Kontrollera att filen inte är skadad och försök ladda upp igen.';

                return new Response(
                  JSON.stringify({
                    success: false,
                    is_valid_cv: false,
                    document_type: 'Oläsbar PDF',
                    summary: { summary_text: pdfSummaryText, key_points: pdfKeyPoints },
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            } else if (contentType.startsWith('image/')) {
              // Images ARE supported - send them to the AI
              const buffer = await docResponse.arrayBuffer();
              const bytes = new Uint8Array(buffer);

              let binary = '';
              const chunkSize = 0x8000;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
              }
              const base64Doc = btoa(binary);
              needsVisionModel = true;

              userContent = [
                {
                  type: 'text',
                  text: 'Analysera dokumentet enligt instruktionerna och returnera ENDAST JSON.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${contentType};base64,${base64Doc}`,
                  },
                },
              ];
            } else {
              // Text-based documents (DOCX, TXT, etc.)
              console.log('Text document detected, extracting content...');
              userContent = await docResponse.text();
              rawExtractedText = typeof userContent === 'string' ? userContent : null;
              console.log(`Text content length: ${typeof userContent === 'string' ? userContent.length : 0} chars`);
            }
          }
        }
      } catch (cvError) {
        console.error('Error processing document:', cvError);
      }
    }

    // ONLY use uploaded document content - not profile or application info
    // The summary should be based PURELY on the uploaded document

    if (!userContent) {
      // Distinguish "no CV at all" from "CV exists but could not be downloaded/read",
      // so the UI can tell the user to retry instead of claiming no file is uploaded.
      const noFile = !finalCvUrl;
      return new Response(
        JSON.stringify({
          success: false,
          code: noFile ? 'no_document' : 'document_unreadable',
          error: noFile
            ? 'Inget dokument uppladdat för denna kandidat'
            : 'Dokumentet kunde inte läsas just nu. Försök igen om en stund.',
        }),
        { status: noFile ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Call AI to generate summary
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ROBUST CV classification prompt - handles ALL languages and document types
    const systemPrompt = `Du är en expert på dokumentanalys och rekrytering.

UPPGIFT (två delar):
1. Beskriv ALLTID vad dokumentet faktiskt innehåller — även om det inte är ett CV.
2. Avgör om dokumentet är ett CV/resume.

ETT CV INNEHÅLLER TYPISKT:
- Personens namn och kontaktuppgifter
- Arbetslivserfarenhet med datum och arbetsgivare
- Utbildningshistorik
- Färdigheter eller kompetenser
- Eventuellt: certifikat, språkkunskaper, referenser

DESSA ÄR INTE CV:n (is_valid_cv: false):
foton på personer/barn/djur/hus/bilar/natur, skärmdumpar, fakturor, kvitton,
skattebesked, anställningsavtal, lönespecifikationer, skolbetyg, ID-handlingar
(pass, körkort), enstaka diplom/certifikat, brev, chatloggar, listor,
menyer, ritningar, tomma eller oläsbara dokument, memes.

NÄR DET INTE ÄR ETT CV:
Beskriv innehållet konkret och sakligt i 1–2 meningar, så att en arbetsgivare
direkt förstår vad filen är utan att öppna den. Exempel:
- "Det här är ett foto av en gul villa med trädgård, taget utomhus i dagsljus."
- "Det här är en faktura från Telia på 499 kr med förfallodatum 2026-02-01."
- "Det här är en skärmdump från en chattkonversation i Messenger."
Nämn INTE namn på privatpersoner som syns på foton, och gissa aldrig om saknad
information. Om dokumentet är helt oläsbart, skriv det rakt ut.
Sätt key_points till 2–3 korta punkter som beskriver innehållet
(t.ex. "Innehåll: foto på byggnad", "Text i bilden: ingen", "Rekommendation: ladda upp ditt CV").

FLERSPRÅKIGT STÖD:
- CV kan vara på ALLA språk. Kan du se struktur som liknar ett CV (jobb + utbildning), godkänn det.
- Kan du inte läsa språket alls, sätt document_type till "oläsbart dokument" och beskriv vad du ändå ser.

SVARSFORMAT (ALLTID JSON):

Om det INTE är ett CV:
{
  "is_valid_cv": false,
  "document_type": "[specifik typ, t.ex. 'foto på byggnad', 'faktura', 'skärmdump', 'anställningsintyg', 'oläsbart dokument']",
  "rejection_reason": "[konkret beskrivning av vad dokumentet innehåller, 1-2 meningar]",
  "summary_text": "[samma konkreta beskrivning av innehållet]",
  "key_points": ["Innehåll: ...", "Detaljer: ...", "Rekommendation: ladda upp ditt CV för en full analys"]
}

Om det ÄR ett CV:
{
  "is_valid_cv": true,
  "document_type": "CV",
  "rejection_reason": null,
  "summary_text": "[2-3 meningar som sammanfattar kandidatens bakgrund]",
  "key_points": [
    "Erfarenhet: [huvudsakliga roller och branscher]",
    "Utbildning: [högsta/relevanta utbildning]",
    "Övrigt: [certifikat, språk, eller andra nyckelkompetenser]"
  ]
}

VIKTIGT:
- Svara ENDAST med JSON, ingen annan text
- summary_text får ALDRIG vara tom — beskriv alltid vad du ser
- Om osäker på om det är ett CV, luta åt is_valid_cv: false men beskriv ändå innehållet
- Skriv allt på svenska, professionellt och hjälpsamt`;


    const aiController = new AbortController();
    const aiTimeoutId = setTimeout(() => aiController.abort(), 60000); // 60s timeout for AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Cost control: cheap model for plain text, stronger multimodal model only for images/scanned PDFs
        model: needsVisionModel ? 'google/gemini-3.5-flash' : 'google/gemini-3.1-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_completion_tokens: 2000,
      }),
      signal: aiController.signal,
    });
    clearTimeout(aiTimeoutId);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Försök igen senare.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits slut. Kontakta support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI-tjänsten kunde inte svara' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Inget svar från AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse AI response
    let summary;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        summary = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      summary = {
        is_valid_cv: false,
        document_type: 'okänt dokument',
        summary_text: '',
        key_points: []
      };
    }

    // Meta to detect stale summaries when candidates upload a new document
    const meta = {
      source_cv_url: finalCvUrl || null,
      content_type: contentType || null,
      analyzed_at: new Date().toISOString(),
    };

    const documentType = summary.is_valid_cv === false 
      ? (summary.document_type || 'okänt dokument')
      : 'CV';
    
    // Professional rejection message - use AI's reason or fallback
    const rejectionReason = summary.rejection_reason || 
      `Det uppladdade dokumentet verkar vara ${documentType}. Ladda upp ett CV för att få en sammanfattning.`;
    
    const docPoint = { 
      text: `Dokumenttyp: ${documentType}`, 
      type: summary.is_valid_cv === false ? 'negative' : 'neutral', 
      meta 
    };

    const normalizedPoints = Array.isArray(summary.key_points)
      ? summary.key_points
          .map((p: any) => (typeof p === 'string' ? { text: p, type: 'neutral' } : p))
          .filter((p: any) => typeof p?.text === 'string' && p.text.trim().length > 0)
      : [];

    // User-friendly message for non-CV documents (prefer the AI's concrete description)
    const summaryText = summary.is_valid_cv === false
      ? (summary.summary_text?.trim() || rejectionReason)
      : (summary.summary_text || '');

    // Never persist an empty analysis — an unparsable/blank AI answer must be retried,
    // not cached as "klar" (which would freeze the profile in an empty state forever).
    if (!summaryText.trim()) {
      console.error('AI returned an empty summary — not saving, will retry on next run');
      return new Response(
        JSON.stringify({ error: 'AI-tjänsten svarade ofullständigt. Försök igen.', code: 'ai_empty_response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }




    // ALWAYS save to profile_cv_summaries for proactive analysis (background pre-analysis)
    if (isProactiveAnalysis && finalCvUrl) {
      console.log('Saving proactive CV summary to profile_cv_summaries');
      const { error: profileSaveError } = await supabase
        .from('profile_cv_summaries')
        .upsert({
          user_id: applicant_id,
          cv_url: finalCvUrl,
          is_valid_cv: summary.is_valid_cv !== false,
          document_type: documentType,
          summary_text: summaryText,
          key_points: [docPoint, ...normalizedPoints],
          raw_text: rawExtractedText,
          analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (profileSaveError) {
        console.error('Error saving proactive summary:', profileSaveError);
      } else {
        console.log('Proactive CV summary saved successfully');
      }
    }

    // Save to candidate_summaries if we have a job_id (job-specific analysis)
    const saveJobId = job_id || application?.job_id;
    if (saveJobId) {
      const { error: saveError } = await supabase
        .from('candidate_summaries')
        .upsert({
          job_id: saveJobId,
          applicant_id,
          application_id: application?.id || application_id,
          summary_text: summaryText,
          key_points: [docPoint, ...normalizedPoints],
          raw_text: rawExtractedText,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'job_id,applicant_id',
        });

      if (saveError) {
        console.error('Error saving job-specific summary:', saveError);
      }
    }

    console.log('CV summary generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        is_valid_cv: summary.is_valid_cv !== false,
        document_type: documentType,
        summary: {
          summary_text: summaryText,
          key_points: [docPoint, ...normalizedPoints],
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-cv-summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
