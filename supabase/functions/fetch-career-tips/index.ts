// Career Tips Fetcher - Multi-source RSS with smart filtering for job seekers
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Swedish career and job seeking RSS sources
const RSS_SOURCES = [
  { url: 'https://www.resume.se/feed/', name: 'Resumé' },
  { url: 'https://www.chef.se/feed/', name: 'Chef.se' },
  { url: 'https://arbetsvarlden.se/feed/', name: 'Arbetsvärlden' },
  { url: 'https://www.dn.se/rss/ekonomi/', name: 'DN Ekonomi' },
  { url: 'https://www.svd.se/feed/naringsliv', name: 'SvD Näringsliv' },
  { url: 'https://www.breakit.se/feed/artiklar', name: 'Breakit' },
];

const NEGATIVE_KEYWORDS = ['skandal', 'misslyck', 'konflikt', 'döm', 'åtal', 'brott', 'svek', 'fusk', 'bedrägeri', 'diskriminer', 'mobbing', 'trakasser', 'hot', 'våld', 'varsel', 'uppsägning', 'neddragning', 'konkurs'];

const CAREER_KEYWORDS = ['karriär', 'jobb', 'arbete', 'cv', 'intervju', 'ansökan', 'lön', 'förhandl', 'kompetens', 'utbildning', 'utveckling', 'mentor', 'nätverk', 'linkedin', 'rekrytering', 'anställ', 'arbetsgivare', 'arbetsmarknad', 'söka jobb', 'jobbsöka', 'arbetssök', 'tips', 'råd', 'personligt brev', 'befordran', 'feedback', 'prestation', 'målsättning', 'arbetsliv', 'balans', 'motivation', 'engagemang', 'kompetensbredd', 'erfarenhet'];

const BLOCKLIST = ['ukraina', 'ryssland', 'putin', 'gaza', 'israel', 'hamas', 'bitcoin', 'ethereum', 'kryptovaluta', 'fotboll', 'hockey', 'konsert', 'melodifestival'];

const CATEGORIES = [
  { key: 'cv', label: 'CV & Ansökan', icon: 'FileText', gradient: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90', keywords: ['cv', 'personligt brev', 'ansökan', 'portfolio'] },
  { key: 'interview', label: 'Intervjutips', icon: 'MessageSquare', gradient: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90', keywords: ['intervju', 'frågor', 'förbereda', 'presentation'] },
  { key: 'networking', label: 'Nätverk', icon: 'Users', gradient: 'from-violet-500/90 via-purple-600/80 to-purple-700/90', keywords: ['nätverk', 'kontakt', 'linkedin', 'event', 'mentor'] },
  { key: 'salary', label: 'Lön & Förhandling', icon: 'Wallet', gradient: 'from-amber-500/90 via-orange-500/80 to-orange-600/90', keywords: ['lön', 'förhandl', 'erbjudande', 'bonus', 'villkor'] },
  { key: 'career', label: 'Karriärutveckling', icon: 'Rocket', gradient: 'from-cyan-500/90 via-sky-500/80 to-blue-600/90', keywords: ['karriär', 'utveckling', 'befordran', 'mål', 'kompetens'] },
  { key: 'market', label: 'Arbetsmarknad', icon: 'TrendingUp', gradient: 'from-rose-500/90 via-red-500/80 to-red-600/90', keywords: ['arbetsmarknad', 'trend', 'bransch', 'efterfrågan'] },
];

function isWithin5Days(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    return (Date.now() - d.getTime()) <= fiveDaysMs;
  } catch { 
    return false; 
  }
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

function isCareerRelevant(text: string): boolean {
  const t = text.toLowerCase();
  if (BLOCKLIST.some(k => t.includes(k))) return false;
  return CAREER_KEYWORDS.some(k => t.includes(k));
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
  return 'career';
}

function getCatInfo(key: string) {
  return CATEGORIES.find(c => c.key === key) || CATEGORIES.find(c => c.key === 'career')!;
}

function truncateAtSentence(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastDot = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? ')
  );
  if (lastDot > maxLen * 0.4) {
    return truncated.slice(0, lastDot + 1).trim();
  }
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) {
    return truncated.slice(0, lastSpace).trim() + '...';
  }
  return truncated.trim() + '...';
}

interface RSSItem {
  title: string;
  summary: string;
  source: string;
  source_url: string | null;
  category: string;
  published_at: string | null;
  isNegative: boolean;
}

async function fetchRSS(source: { url: string; name: string }): Promise<RSSItem[]> {
  try {
    const r = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Parium/1.0)', 'Accept': 'application/rss+xml, text/xml, */*' } });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = parseRSSItems(xml);
    
    return items.slice(0, 15).filter(i => {
      const full = `${i.title} ${i.description}`;
      return isCareerRelevant(full) && !isNegative(full); // Only positive career content
    }).map(i => {
      const full = `${i.title} ${i.description}`;
      return {
        title: i.title,
        summary: truncateAtSentence(i.description, 250) || i.title,
        source: source.name,
        source_url: i.link || null,
        category: categorize(full),
        published_at: i.pubDate,
        isNegative: false,
      };
    });
  } catch (e) {
    console.error(`Error ${source.name}:`, e);
    return [];
  }
}

async function generateAIFallbackTips(supabase: any): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured, cannot generate AI fallback');
    return [];
  }
  
  console.log('Generating AI fallback career tips...');
  
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
            content: `Du är en erfaren karriärcoach i Sverige. Din uppgift är att generera 4 PRAKTISKA och POSITIVA karriärtips för jobbsökare.

VIKTIGA REGLER:
- Fokusera på PRAKTISKA, KONKRETA tips som jobbsökare kan använda direkt
- Skriv på svenska, positivt och uppmuntrande
- Basera på beprövad erfarenhet och forskning inom rekrytering
- Ingen negativitet eller varning - bara positiva, konstruktiva tips
- Skriv utförliga sammanfattningar med 3-4 meningar som ger konkret värde

KATEGORIER ATT TÄCKA:
- CV & Ansökan - hur man skriver bra CV och personligt brev
- Intervjutips - hur man förbereder sig och presterar på intervjuer
- Nätverk - hur man bygger och använder sitt professionella nätverk
- Lön & Förhandling - hur man förhandlar lön och villkor

Svara ENDAST med giltig JSON.`
          },
          {
            role: "user",
            content: `Generera 4 konkreta karriärtips i detta exakta JSON-format:
[
  {
    "title": "Kort rubrik max 60 tecken - börja med ett verb som 'Förbered', 'Optimera', 'Bygg'",
    "summary": "UTFÖRLIG sammanfattning på 3-4 meningar (ca 300-400 tecken). Beskriv tipset, förklara varför det är viktigt, och ge ett konkret exempel.",
    "category": "En av: cv, interview, networking, salary, career, market"
  }
]`
          }
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error('AI fallback failed:', response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return [];
    }
    
    const tipsItems = JSON.parse(jsonMatch[0]);
    const today = new Date().toISOString().split('T')[0];
    
    return tipsItems.slice(0, 4).map((item: any, idx: number) => {
      const catInfo = getCatInfo(item.category);
      const minutesAgo = [0, 15, 35, 60][idx] || idx * 20;
      const itemTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
      return {
        title: item.title,
        summary: item.summary,
        source: 'Karriärcoach',
        source_url: null,
        category: catInfo.label,
        icon_name: catInfo.icon,
        gradient: catInfo.gradient,
        news_date: today,
        order_index: idx,
        published_at: itemTime,
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    const mode = typeof body.mode === 'string' ? body.mode : 'auto';

    // Explicit AI mode
    if (mode === 'ai') {
      console.log('Forced AI mode for career tips...');
      const aiTips = await generateAIFallbackTips(supabase);
      if (aiTips.length) {
        await supabase
          .from('daily_career_tips')
          .delete()
          .eq('source', 'Karriärcoach')
          .is('source_url', null);
        await supabase.from('daily_career_tips').insert(aiTips);
        return new Response(
          JSON.stringify({ message: 'AI tips generated', count: aiTips.length, source: 'ai' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ message: 'AI tips failed', count: 0, source: 'ai' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!force) {
      const { data } = await supabase
        .from('daily_career_tips')
        .select('id')
        .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
        .limit(1);
      if (data?.length)
        return new Response(JSON.stringify({ message: 'Fresh tips exists', skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log('Fetching career tips...');
    const results = await Promise.all(RSS_SOURCES.map(fetchRSS));
    
    const seen = new Set<string>();
    let all = results.flat().filter(i => {
      if (!i.published_at) return false;
      const n = i.title.toLowerCase().replace(/[^a-zåäö0-9]/g, '').slice(0, 50);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
    
    all.sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
    
    // Balance sources - max 2 per source
    const srcCount: Record<string, number> = {};
    const balanced: typeof all = [];
    
    for (const a of all) {
      if ((srcCount[a.source] || 0) < 2) {
        balanced.push(a);
        srcCount[a.source] = (srcCount[a.source] || 0) + 1;
      }
      if (balanced.length >= 20) break;
    }
    
    console.log(`Found ${balanced.length} career articles after source balancing`);
    
    // Fetch existing urls to de-duplicate
    const { data: existingRss } = await supabase
      .from('daily_career_tips')
      .select('source_url')
      .not('source_url', 'is', null)
      .limit(50);

    const existingUrls = new Set((existingRss || []).map((a: any) => a.source_url).filter(Boolean));
    const newItems = balanced.filter(i => !i.source_url || !existingUrls.has(i.source_url));

    // Delete old articles
    await supabase
      .from('daily_career_tips')
      .delete()
      .not('source_url', 'is', null)
      .lt('news_date', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    const today = new Date().toISOString().split('T')[0];

    // Insert new RSS articles
    let insertedRss = 0;
    if (newItems.length) {
      const insert = newItems.slice(0, 4).map((i, idx) => {
        const cat = getCatInfo(i.category);
        return {
          title: i.title,
          summary: i.summary,
          source: i.source,
          source_url: i.source_url,
          category: cat.label,
          icon_name: cat.icon,
          gradient: cat.gradient,
          news_date: today,
          order_index: idx,
          published_at: i.published_at,
        };
      });

      await supabase.from('daily_career_tips').insert(insert);
      insertedRss = insert.length;
      console.log(`Inserted ${insertedRss} career articles`);
    }

    // Enforce 4-slot rule
    const { data: afterInsert } = await supabase
      .from('daily_career_tips')
      .select('id, source, source_url, published_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const items = afterInsert || [];

    // Trim to 4
    if (items.length > 4) {
      const idsToRemove = items.slice(4).map((r: any) => r.id);
      if (idsToRemove.length) {
        await supabase.from('daily_career_tips').delete().in('id', idsToRemove);
      }
    }

    // Check if we need AI fallback
    const { data: trimmed } = await supabase
      .from('daily_career_tips')
      .select('id, source, source_url, published_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(10);

    const top = trimmed || [];

    let aiAdded = 0;
    if (top.length < 4) {
      const needed = 4 - top.length;
      console.log(`Only ${top.length} tips, topping up with ${needed} AI tip(s)`);

      const aiTips = await generateAIFallbackTips(supabase);
      if (aiTips.length) {
        const oldestTs = top.reduce((minTs: number, r: any) => {
          const t = r.published_at ? new Date(r.published_at).getTime() : Date.now();
          return Math.min(minTs, t);
        }, Date.now());

        const fillers = aiTips.slice(0, needed).map((item: any, idx: number) => ({
          ...item,
          news_date: today,
          order_index: top.length + idx,
          published_at: new Date(oldestTs - (idx + 1) * 60 * 1000).toISOString(),
        }));

        await supabase.from('daily_career_tips').insert(fillers);
        aiAdded = fillers.length;
        console.log(`Inserted ${aiAdded} AI filler tip(s)`);
      }
    }

    // Final enforce: 4 slots MAX, max 2 per source
    const { data: finalItems } = await supabase
      .from('daily_career_tips')
      .select('id, source, category, published_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const finalList = finalItems || [];
    
    const finalSourceCount: Record<string, number> = {};
    const balancedFinal: typeof finalList = [];
    const idsToRemove: string[] = [];
    
    for (const item of finalList) {
      const count = finalSourceCount[item.source] || 0;
      if (count < 2 && balancedFinal.length < 4) {
        balancedFinal.push(item);
        finalSourceCount[item.source] = count + 1;
      } else {
        idsToRemove.push(item.id);
      }
    }
    
    if (idsToRemove.length > 0) {
      console.log(`Removing ${idsToRemove.length} items (source balance or excess)`);
      await supabase.from('daily_career_tips').delete().in('id', idsToRemove);
    }

    const topSources = [...new Set(balancedFinal.map((i: any) => i.source))];
    const topCategories = [...new Set(balancedFinal.map((i: any) => i.category))];

    return new Response(
      JSON.stringify({
        message: 'Career tips fetched successfully',
        rss_count: insertedRss,
        ai_added: aiAdded,
        total_after: balancedFinal.length,
        sources: topSources,
        categories: topCategories,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('Fatal error in fetch-career-tips:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
