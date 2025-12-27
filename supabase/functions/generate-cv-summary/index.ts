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
    const { applicant_id, application_id, job_id } = await req.json();
    
    if (!applicant_id) {
      return new Response(
        JSON.stringify({ error: 'applicant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating CV summary for applicant ${applicant_id}`);

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

    // Fetch application if provided
    let application = null;
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

    // Get CV URL from profile or application
    const cvUrl = application?.cv_url || profile?.cv_url;
    
    let cvText = '';
    
    if (cvUrl) {
      console.log('CV URL found:', cvUrl);
      
      // Download and extract text from CV
      try {
        // Get signed URL for the CV
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('job-applications')
          .createSignedUrl(cvUrl, 300); // 5 min expiry
        
        if (signedUrlError) {
          console.error('Error getting signed URL:', signedUrlError);
        } else if (signedUrlData?.signedUrl) {
          console.log('Got signed URL, downloading CV...');
          
          // Download the CV file
          const cvResponse = await fetch(signedUrlData.signedUrl);
          
          if (cvResponse.ok) {
            const contentType = cvResponse.headers.get('content-type') || '';
            console.log('CV content type:', contentType);
            
            if (contentType.includes('pdf')) {
              // For PDF files, we'll use the AI's vision capabilities
              // or extract what we can from the binary
              const buffer = await cvResponse.arrayBuffer();
              const base64Cv = btoa(String.fromCharCode(...new Uint8Array(buffer)));
              
              // Store the base64 for later use with AI vision
              cvText = `[PDF CV UPPLADDAD - ${buffer.byteLength} bytes]`;
              
              // Use AI with PDF parsing capability
              const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
              if (LOVABLE_API_KEY) {
                try {
                  // Use Gemini's multimodal capabilities to read the PDF
                  const visionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: 'google/gemini-2.5-flash',
                      messages: [
                        {
                          role: 'user',
                          content: [
                            {
                              type: 'text',
                              text: 'Extrahera all text från detta CV-dokument. Ge mig en strukturerad sammanfattning av personens: 1) Arbetslivserfarenhet, 2) Utbildning, 3) Certifieringar/körkort, 4) Kompetenser. Svara på svenska.'
                            },
                            {
                              type: 'image_url',
                              image_url: {
                                url: `data:application/pdf;base64,${base64Cv}`
                              }
                            }
                          ]
                        }
                      ],
                    }),
                  });
                  
                  if (visionResponse.ok) {
                    const visionData = await visionResponse.json();
                    cvText = visionData.choices?.[0]?.message?.content || cvText;
                    console.log('Extracted CV text via AI vision');
                  } else {
                    console.error('Vision API error:', await visionResponse.text());
                  }
                } catch (visionError) {
                  console.error('Vision extraction error:', visionError);
                }
              }
            } else if (contentType.includes('text') || contentType.includes('plain')) {
              // Plain text CV
              cvText = await cvResponse.text();
            }
          }
        }
      } catch (cvError) {
        console.error('Error processing CV:', cvError);
      }
    }

    // Build candidate context from available data
    let candidateInfo = '';
    
    if (profile) {
      candidateInfo += '=== PROFILINFORMATION ===\n';
      if (profile.first_name || profile.last_name) {
        candidateInfo += `Namn: ${profile.first_name || ''} ${profile.last_name || ''}\n`;
      }
      if (profile.occupation) candidateInfo += `Yrke: ${profile.occupation}\n`;
      if (profile.bio) candidateInfo += `Om mig: ${profile.bio}\n`;
      if (profile.city) candidateInfo += `Stad: ${profile.city}\n`;
      if (profile.availability) candidateInfo += `Tillgänglighet: ${profile.availability}\n`;
      if (profile.work_schedule) candidateInfo += `Arbetstider: ${profile.work_schedule}\n`;
      if (profile.employment_type) candidateInfo += `Anställningstyp: ${profile.employment_type}\n`;
    }

    if (application) {
      candidateInfo += '\n=== ANSÖKNINGSINFO ===\n';
      if (application.cover_letter) candidateInfo += `Personligt brev: ${application.cover_letter}\n`;
      if (application.employment_status) candidateInfo += `Anställningsstatus: ${application.employment_status}\n`;
    }

    if (cvText && cvText.length > 50) {
      candidateInfo += '\n=== CV-INNEHÅLL ===\n' + cvText;
    }

    // Check if we have enough data to generate a summary
    if (!candidateInfo.trim() && !cvText.trim()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Ingen profilinformation eller CV tillgängligt för denna kandidat' 
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

    const systemPrompt = `Du är en rekryteringsassistent som sammanfattar kandidaters CV och profil.

Din uppgift är att analysera kandidatens information och ge en KORT sammanfattning med 4-6 konkreta punkter.

FOKUSERA PÅ:
- Arbetslivserfarenhet (företag, roller, tid)
- Utbildning
- Körkort och certifieringar (truckkort, etc.)
- Kompetenser och färdigheter
- Tillgänglighet och preferenser

SVARSFORMAT (JSON):
{
  "summary_text": "En mening som sammanfattar kandidaten",
  "key_points": [
    "Punkt 1: Konkret observation",
    "Punkt 2: Konkret observation",
    "Punkt 3: Konkret observation",
    "Punkt 4: Konkret observation"
  ]
}

VIKTIGT:
- Varje punkt ska vara en konkret fakta från CV:et/profilen
- Skriv på svenska
- Om information saknas, nämn det inte alls
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
          { role: 'user', content: candidateInfo || 'Ingen information tillgänglig.' },
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
      // Create a fallback summary
      summary = {
        summary_text: content.substring(0, 200),
        key_points: content.split('\n').filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('•')).slice(0, 5)
      };
    }

    // Save summary to database
    const saveJobId = job_id || application?.job_id;
    if (saveJobId) {
      const { error: saveError } = await supabase
        .from('candidate_summaries')
        .upsert({
          job_id: saveJobId,
          applicant_id,
          application_id: application?.id || application_id,
          summary_text: summary.summary_text || '',
          key_points: Array.isArray(summary.key_points) 
            ? summary.key_points.map((p: string | { text: string }) => 
                typeof p === 'string' ? { text: p, type: 'neutral' } : p
              )
            : [],
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'job_id,applicant_id',
        });

      if (saveError) {
        console.error('Error saving summary:', saveError);
      }
    }

    console.log('Summary generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          summary_text: summary.summary_text,
          key_points: summary.key_points,
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
