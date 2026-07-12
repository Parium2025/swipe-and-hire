import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'administration', label: 'Administration, Ekonomi, Juridik' },
  { value: 'construction', label: 'Bygg och Anläggning' },
  { value: 'management', label: 'Chefer och Verksamhetsledare' },
  { value: 'it', label: 'Data/IT' },
  { value: 'sales', label: 'Försäljning, Inköp, Marknadsföring' },
  { value: 'crafts', label: 'Hantverkyrken' },
  { value: 'restaurant', label: 'Hotell, Restaurang, Storhushåll' },
  { value: 'healthcare', label: 'Hälso- och Sjukvård' },
  { value: 'industry', label: 'Industriell Tillverkning' },
  { value: 'installation', label: 'Installation, Drift, Underhåll' },
  { value: 'logistics', label: 'Transport, Bud och Förare' },
  { value: 'warehouse', label: 'Lager och Logistik' },
  { value: 'beauty', label: 'Kropps- och Skönhetsvård' },
  { value: 'creative', label: 'Kultur, Media, Design' },
  { value: 'military', label: 'Militärt Arbete' },
  { value: 'agriculture', label: 'Naturbruk' },
  { value: 'science', label: 'Naturvetenskapligt Arbete' },
  { value: 'education', label: 'Pedagogiskt Arbete' },
  { value: 'cleaning', label: 'Sanering och Renhållning' },
  { value: 'security', label: 'Säkerhet och Skydd' },
  { value: 'social', label: 'Socialt Arbete' },
  { value: 'technical', label: 'Tekniskt Arbete' },
];

const VALID = new Set(CATEGORIES.map((c) => c.value));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 🔒 Kräv inloggad användare — förhindrar att endpoint missbrukas som gratis AI-oracle
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || '').slice(0, 300);
    const description = String(body?.description || '').slice(0, 3000);
    const occupation = String(body?.occupation || '').slice(0, 200);

    if (!title && !description && !occupation) {
      return new Response(JSON.stringify({ category: null, confidence: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const categoryList = CATEGORIES.map((c) => `- "${c.value}" = ${c.label}`).join('\n');

    const systemPrompt = `Du är en expertklassificerare för svenska jobbannonser. Din uppgift är att välja EXAKT ETT yrkesområde som passar bäst för jobbet, från denna lista:

${categoryList}

Regler:
- Läs titel, yrke och beskrivning noggrant.
- Väg alla signaler: arbetsuppgifter, verktyg, bransch, kompetenser.
- Om en titel är hybrid (t.ex. "Säljare + Chef") — välj det MEST framträdande området.
- Om jobbet är helt otydligt — sätt category till null.
- Confidence: 0.9-1.0 = mycket säker, 0.7-0.89 = säker, 0.5-0.69 = osäker, under 0.5 = gissning.

Svara ENDAST med giltig JSON i detta format:
{"category": "värde-från-listan-eller-null", "confidence": 0.0-1.0, "reasoning": "kort motivering på svenska (max 15 ord)"}`;

    const userPrompt = `Titel: ${title || '(saknas)'}
Yrke: ${occupation || '(saknas)'}
Beskrivning: ${description || '(saknas)'}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('AI gateway error', resp.status, errText);
      // 429 = rate limit, 402 = credits exhausted — meddela klienten men krascha inte publiceringen
      return new Response(
        JSON.stringify({ category: null, confidence: 0, error: `AI ${resp.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await resp.json();
    const rawContent = String(data?.choices?.[0]?.message?.content || '').trim();

    let parsed: { category?: string | null; confidence?: number; reasoning?: string } = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Fallback: försök hitta ett giltigt värde i råtexten
      const lower = rawContent.toLowerCase();
      for (const c of CATEGORIES) {
        if (lower.includes(`"${c.value}"`)) {
          parsed = { category: c.value, confidence: 0.5 };
          break;
        }
      }
    }

    const category = parsed.category && VALID.has(parsed.category) ? parsed.category : null;
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

    // Under 0.5 confidence = för osäkert, spara som null istället för fel gissning
    const finalCategory = confidence >= 0.5 ? category : null;

    console.log('categorize-job-ai result:', {
      title: title.slice(0, 50),
      category: finalCategory,
      confidence,
      reasoning: parsed.reasoning,
    });

    return new Response(
      JSON.stringify({
        category: finalCategory,
        confidence,
        reasoning: parsed.reasoning || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('categorize-job-ai error', err);
    return new Response(
      JSON.stringify({ category: null, confidence: 0, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
