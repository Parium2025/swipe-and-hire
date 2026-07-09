import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
      return new Response(JSON.stringify({ category: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const categoryList = CATEGORIES.map((c) => `- ${c.value}: ${c.label}`).join('\n');

    const systemPrompt = `Du är en klassificerare för svenska jobbannonser. Välj EXAKT ETT yrkesområde från listan som passar bäst för jobbet. Svara ENDAST med värdet (t.ex. "logistics"), inget annat.

Kategorier:
${categoryList}

Om jobbet inte tydligt passar in svara "none".`;

    const userPrompt = `Titel: ${title}\nYrke: ${occupation}\nBeskrivning: ${description}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 20,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('AI gateway error', resp.status, errText);
      return new Response(JSON.stringify({ category: null, error: `AI ${resp.status}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const raw = String(data?.choices?.[0]?.message?.content || '').trim().toLowerCase();
    const cleaned = raw.replace(/[^a-z]/g, '');
    const category = VALID.has(cleaned) ? cleaned : null;

    return new Response(JSON.stringify({ category }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('categorize-job-ai error', err);
    return new Response(JSON.stringify({ category: null, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
