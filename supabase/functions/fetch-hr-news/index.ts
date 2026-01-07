// HR News Fetcher - Multi-source RSS with smart filtering
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRUSTED_SOURCES = ['HRnytt.se', 'Chef.se', 'Arbetsvärlden', 'DN Ekonomi', 'Expressen Ekonomi', 'Dagens Industri', 'SvD Näringsliv', 'Breakit'];

const RSS_SOURCES = [
  { url: 'https://hrnytt.se/feed/', name: 'HRnytt.se' },
  { url: 'https://www.chef.se/feed/', name: 'Chef.se' },
  { url: 'https://arbetsvarlden.se/feed/', name: 'Arbetsvärlden' },
  { url: 'https://www.dn.se/rss/ekonomi/', name: 'DN Ekonomi' },
  { url: 'https://www.di.se/rss', name: 'Dagens Industri' },
  { url: 'https://feeds.expressen.se/ekonomi', name: 'Expressen Ekonomi' },
  { url: 'https://www.svd.se/feed/naringsliv', name: 'SvD Näringsliv' },
  { url: 'https://www.breakit.se/feed/artiklar', name: 'Breakit' },
];

const NEGATIVE_KEYWORDS = ['skandal', 'misslyck', 'konflikt', 'döm', 'åtal', 'brott', 'svek', 'fusk', 'bedrägeri', 'diskriminer', 'mobbing', 'trakasser', 'hot', 'våld'];

const HR_KEYWORDS = ['hr', 'rekryter', 'anställ', 'personal', 'medarbetar', 'arbetsplats', 'arbetsmiljö', 'arbetsgivare', 'arbetsmarknad', 'chef', 'ledar', 'team', 'organisation', 'talent', 'kompetens', 'karriär', 'lön', 'kandidat', 'intervju', 'onboarding', 'hybridarbete', 'distansarbete', 'engagemang', 'motivation', 'arbetslöshet', 'varsel', 'uppsägning', 'nyanställ', 'tillväxt'];

const BLOCKLIST = ['ukraina', 'ryssland', 'putin', 'gaza', 'israel', 'hamas', 'bitcoin', 'ethereum', 'kryptovaluta', 'fotboll', 'hockey', 'konsert', 'melodifestival'];

const CATEGORIES = [
  { key: 'labor_market', label: 'Arbetsmarknad', icon: 'Briefcase', gradient: 'from-rose-500/90 via-red-500/80 to-red-600/90', keywords: ['arbetslös', 'varsel', 'uppsägning', 'neddragning', 'konkurs'] },
  { key: 'salary', label: 'Lön & Förmåner', icon: 'Wallet', gradient: 'from-green-500/90 via-emerald-500/80 to-emerald-600/90', keywords: ['lön', 'löneökning', 'bonus', 'pension', 'förmån'] },
  { key: 'career', label: 'Karriär & Utveckling', icon: 'Rocket', gradient: 'from-cyan-500/90 via-sky-500/80 to-blue-600/90', keywords: ['karriär', 'befordran', 'utveckling', 'coaching', 'utbildning'] },
  { key: 'hr_tech', label: 'HR-Tech', icon: 'Cpu', gradient: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90', keywords: ['ai', 'tech', 'digital', 'automatiser', 'system', 'robot'] },
  { key: 'trends', label: 'Trender', icon: 'TrendingUp', gradient: 'from-amber-500/90 via-orange-500/80 to-orange-600/90', keywords: ['trend', 'framtid', '2026', '2025', 'förändring'] },
  { key: 'leadership', label: 'Ledarskap', icon: 'Users', gradient: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90', keywords: ['ledar', 'chef', 'team', 'medarbetar', 'kultur', 'feedback'] },
  { key: 'recruitment', label: 'Rekrytering', icon: 'UserPlus', gradient: 'from-violet-500/90 via-purple-600/80 to-purple-700/90', keywords: ['rekryter', 'kandidat', 'anställ', 'intervju', 'urval', 'talent'] },
  { key: 'business', label: 'Näringsliv', icon: 'Building2', gradient: 'from-slate-500/90 via-gray-600/80 to-zinc-700/90', keywords: ['bolag', 'företag', 'vd', 'ceo', 'resultat', 'expansion'] },
];

function isWithin5Days(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && (Date.now() - d.getTime()) <= 120 * 60 * 60 * 1000;
  } catch { return false; }
}

function parseRSSItems(xml: string): { title: string; description: string; link: string; pubDate: string | null }[] {
  const items: { title: string; description: string; link: string; pubDate: string | null }[] = [];
  const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  
  for (const m of matches) {
    const c = m[1];
    let pubDate: string | null = null;
    const pd = c.match(/<pubDate><!\[CDATA\[(.*?)\]\]><\/pubDate>/i) || c.match(/<pubDate>([^<]*)<\/pubDate>/i) || c.match(/<dc:date>([^<]*)<\/dc:date>/i);
    if (pd) pubDate = pd[1].trim();
    if (pubDate && !isWithin5Days(pubDate)) continue;
    
    let tm = c.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i);
    if (!tm) tm = c.match(/<title>([^<]*)<\/title>/i);
    const title = tm ? tm[1].trim() : '';
    
    let dm = c.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/is);
    if (!dm) dm = c.match(/<description>([^<]*)<\/description>/i);
    let desc = dm ? dm[1].trim().replace(/<[^>]+>/g, '') : '';
    
    const lm = c.match(/<link>([^<]*)<\/link>/i) || c.match(/<guid[^>]*>([^<]*)<\/guid>/i);
    const link = lm ? lm[1].trim() : '';
    
    if (title.length > 10) items.push({ title, description: desc, link, pubDate });
  }
  return items;
}

function isHRRelevant(text: string, source: string): boolean {
  const t = text.toLowerCase();
  if (BLOCKLIST.some(k => t.includes(k))) return false;
  if (TRUSTED_SOURCES.includes(source)) return true;
  return HR_KEYWORDS.some(k => t.includes(k));
}

function isNegative(text: string): boolean {
  const t = text.toLowerCase();
  return NEGATIVE_KEYWORDS.some(k => t.includes(k));
}

function categorize(text: string): string {
  const t = text.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(k => t.includes(k))) return cat.key;
  }
  return 'trends';
}

function getCatInfo(key: string) {
  return CATEGORIES.find(c => c.key === key) || CATEGORIES.find(c => c.key === 'trends')!;
}

async function fetchRSS(source: { url: string; name: string }) {
  try {
    const r = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Parium/1.0)', 'Accept': 'application/rss+xml, text/xml, */*' } });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = parseRSSItems(xml);
    
    return items.slice(0, 15).filter(i => {
      const full = `${i.title} ${i.description}`;
      if (source.name === 'HRnytt.se' && i.link?.includes('/event/')) return false;
      return isHRRelevant(full, source.name) && !isNegative(full);
    }).map(i => ({
      title: i.title,
      summary: i.description.slice(0, 400) || i.title,
      source: source.name,
      source_url: i.link || null,
      category: categorize(`${i.title} ${i.description}`),
      published_at: i.pubDate,
    }));
  } catch (e) {
    console.error(`Error ${source.name}:`, e);
    return [];
  }
}

async function generateAIFallbackNews(supabase: any): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured, cannot generate AI fallback');
    return [];
  }
  
  console.log('Generating AI fallback news...');
  
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Du är en svensk HR-nyhetsredaktör. Generera 4 aktuella och realistiska HR-nyheter på svenska. Nyheterna ska vara positiva eller neutrala och handla om rekrytering, arbetsmarknad, ledarskap eller HR-tech. Svara ENDAST med giltig JSON."
          },
          {
            role: "user",
            content: `Generera 4 HR-nyheter i detta exakta JSON-format:
[
  {
    "title": "Kort rubrik max 80 tecken",
    "summary": "Sammanfattning på 1-2 meningar, max 200 tecken",
    "category": "En av: Rekrytering, Ledarskap, HR-Tech, Arbetsmarknad, Trender"
  }
]`
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('AI fallback failed:', response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return [];
    }
    
    const newsItems = JSON.parse(jsonMatch[0]);
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    const categoryMap: Record<string, { icon: string; gradient: string }> = {
      'Rekrytering': { icon: 'UserPlus', gradient: 'from-violet-500/90 via-purple-600/80 to-purple-700/90' },
      'Ledarskap': { icon: 'Users', gradient: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90' },
      'HR-Tech': { icon: 'Cpu', gradient: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90' },
      'Arbetsmarknad': { icon: 'Briefcase', gradient: 'from-rose-500/90 via-red-500/80 to-red-600/90' },
      'Trender': { icon: 'TrendingUp', gradient: 'from-amber-500/90 via-orange-500/80 to-orange-600/90' },
    };
    
    return newsItems.slice(0, 4).map((item: any, idx: number) => {
      const catInfo = categoryMap[item.category] || categoryMap['Trender'];
      return {
        title: item.title,
        summary: item.summary,
        source: 'Parium',
        source_url: null,
        category: item.category,
        icon_name: catInfo.icon,
        gradient: catInfo.gradient,
        news_date: today,
        order_index: idx,
        published_at: now,
      };
    });
  } catch (e) {
    console.error('AI fallback error:', e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    
    if (!force) {
      const { data } = await supabase.from('daily_hr_news').select('id').gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()).limit(1);
      if (data?.length) return new Response(JSON.stringify({ message: 'Fresh news exists', skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    console.log('Fetching HR news...');
    const results = await Promise.all(RSS_SOURCES.map(fetchRSS));
    
    const seen = new Set<string>();
    let all = results.flat().filter(i => {
      const n = i.title.toLowerCase().replace(/[^a-zåäö0-9]/g, '').slice(0, 50);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
    
    all.sort((a, b) => {
      if (a.published_at && b.published_at) return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      return a.published_at ? -1 : b.published_at ? 1 : 0;
    });
    
    // Balance sources
    const srcCount: Record<string, number> = {};
    const balanced: typeof all = [];
    for (const a of all) {
      if ((srcCount[a.source] || 0) < 2) {
        balanced.push(a);
        srcCount[a.source] = (srcCount[a.source] || 0) + 1;
      }
      if (balanced.length >= 20) break;
    }
    
    const { data: current } = await supabase.from('daily_hr_news').select('id, source_url').limit(10);
    const existingUrls = new Set((current || []).map(a => a.source_url).filter(Boolean));
    const newItems = balanced.filter(i => !i.source_url || !existingUrls.has(i.source_url));
    
    // Delete old
    await supabase.from('daily_hr_news').delete().lt('news_date', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    // If no RSS news at all, use AI fallback
    if (!balanced.length) {
      console.log('No RSS news found, using AI fallback...');
      const aiNews = await generateAIFallbackNews(supabase);
      if (aiNews.length) {
        await supabase.from('daily_hr_news').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('daily_hr_news').insert(aiNews);
        return new Response(JSON.stringify({ message: 'AI fallback news generated', count: aiNews.length, source: 'ai' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ message: 'No news available', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    if (!newItems.length) return new Response(JSON.stringify({ message: 'No new articles', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
    // Smart rotation
    const toAdd = Math.min(4, newItems.length);
    const toKeep = Math.max(0, 4 - toAdd);
    
    if (current && toKeep < current.length) {
      const ids = current.slice(toKeep).map(a => a.id);
      if (ids.length) await supabase.from('daily_hr_news').delete().in('id', ids);
    }
    
    const today = new Date().toISOString().split('T')[0];
    const insert = newItems.slice(0, toAdd).map((i, idx) => {
      const cat = getCatInfo(i.category);
      return { title: i.title, summary: i.summary, source: i.source, source_url: i.source_url, category: cat.label, icon_name: cat.icon, gradient: cat.gradient, news_date: today, order_index: idx, published_at: i.published_at };
    });
    
    await supabase.from('daily_hr_news').insert(insert);
    console.log(`Inserted ${insert.length} articles`);
    
    return new Response(JSON.stringify({ message: 'HR news fetched successfully', count: insert.length, kept: toKeep, sources: [...new Set(insert.map(i => i.source))], categories: [...new Set(insert.map(i => i.category))] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
