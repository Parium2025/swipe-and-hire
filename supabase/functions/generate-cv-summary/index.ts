import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicant_id, application_id, job_id, cv_url_override, proactive } = await req.json();
    
    if (!applicant_id) {
      return new Response(
        JSON.stringify({ error: 'applicant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // proactive=true means this is a background pre-analysis when user uploads CV to their profile
    const isProactiveAnalysis = proactive === true;
    console.log(`Generating CV summary for applicant ${applicant_id}${isProactiveAnalysis ? ' (PROACTIVE)' : ''}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const cvUrl = cv_url_override || profile?.cv_url;
    
    if (isProactiveAnalysis && cvUrl) {
      const { data: existingSummary } = await supabase
        .from('profile_cv_summaries')
        .select('cv_url')
        .eq('user_id', applicant_id)
        .single();
      
      // Skip if CV hasn't changed
      if (existingSummary?.cv_url === cvUrl) {
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
    const finalCvUrl = cv_url_override || application?.cv_url || profile?.cv_url;

    let contentType = '';
    let userContent: string | any[] | null = null;

    if (finalCvUrl) {
      console.log('CV URL found:', finalCvUrl);

      try {
        // Get signed URL for the CV
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('job-applications')
          .createSignedUrl(finalCvUrl, 300); // 5 min expiry

        if (signedUrlError) {
          console.error('Error getting signed URL:', signedUrlError);
        } else if (signedUrlData?.signedUrl) {
          console.log('Got signed URL, downloading document...');

          const docResponse = await fetch(signedUrlData.signedUrl);

          if (docResponse.ok) {
            contentType = docResponse.headers.get('content-type') || '';
            console.log('Document content type:', contentType);

            // For PDFs/images we send the binary directly to the model (no pre-summarization!)
            if (contentType.includes('pdf') || contentType.startsWith('image/')) {
              const buffer = await docResponse.arrayBuffer();
              const bytes = new Uint8Array(buffer);

              let binary = '';
              const chunkSize = 0x8000;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
              }
              const base64Doc = btoa(binary);

              const mime = contentType.includes('pdf') ? 'application/pdf' : (contentType || 'image/png');

              userContent = [
                {
                  type: 'text',
                  text: 'Analysera dokumentet enligt instruktionerna och returnera ENDAST JSON.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mime};base64,${base64Doc}`,
                  },
                },
              ];
            } else {
              // Text-based documents
              userContent = await docResponse.text();
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Inget dokument uppladdat för denna kandidat',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // This is a PURE CV summary function - completely separate from criteria evaluation
    const systemPrompt = `Du är en rekryteringsassistent som ENDAST analyserar och sammanfattar CV-dokument.

KRITISKT: Din uppgift är att identifiera dokumenttyp och ge en FAKTABASERAD sammanfattning.
Du ska INTE utvärdera kandidaten mot några kriterier - det görs av en annan AI.

OM dokumentet INTE är ett CV, identifiera typen:
{
  "is_valid_cv": false,
  "document_type": "[typ]",
  "summary_text": "",
  "key_points": []
}

DOKUMENTTYPER:
- "anställningsavtal", "anställningsintyg", "lönespecifikation", "kvitto", "faktura"
- "skattebesked", "deklaration", "kontrolluppgift", "bild", "skärmdump"
- "brev", "intyg", "diplom", "betyg", "pass", "körkort", "id-kort", "okänt dokument"

OM det är ett CV, ge en NEUTRAL sammanfattning med 3-5 punkter om:
- Arbetslivserfarenhet (vilka jobb, var, hur länge)
- Utbildning (skolor, program, examen)
- Certifikat och behörigheter som nämns i CV:t
- Språkkunskaper om det nämns

SVARSFORMAT FÖR CV:
{
  "is_valid_cv": true,
  "document_type": "CV",
  "summary_text": "Kort sammanfattning av kandidatens bakgrund",
  "key_points": [
    "Arbetat som X på Y i Z år",
    "Utbildning: [specifik utbildning]",
    "Nämner: [certifikat/behörigheter från CV]"
  ]
}

REGLER:
- ENDAST fakta från CV:t - inga bedömningar eller rekommendationer
- Nämn inte "urvalskriterier" eller "krav för rollen"
- Skriv på svenska
- Svara ENDAST med JSON`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });

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
      ? (summary.document_type || 'ett dokument som inte är ett CV')
      : 'CV';
    
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

    const summaryText = summary.is_valid_cv === false
      ? `Det uppladdade dokumentet är ${documentType}. Kan inte läsa av ett CV.`
      : (summary.summary_text || '');

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
