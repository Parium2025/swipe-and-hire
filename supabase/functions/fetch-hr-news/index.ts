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
    if (isNaN(d.getTime())) {
      console.log(`Invalid date format: "${dateStr}"`);
      return false;
    }
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000; // 120 hours = 5 days
    const isRecent = (Date.now() - d.getTime()) <= fiveDaysMs;
    if (!isRecent) {
      console.log(`Article too old: "${dateStr}" (>${Math.floor((Date.now() - d.getTime()) / (24*60*60*1000))} days)`);
    }
    return isRecent;
  } catch (e) { 
    console.log(`Date parse error: "${dateStr}"`, e);
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

function isHRRelevant(text: string, source: string): boolean {
  const t = text.toLowerCase();
  if (BLOCKLIST.some(k => t.includes(k))) return false;
  // Always require HR keywords - no free pass for any source
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

// Truncate text at sentence boundary (ends with . ! or ?)
function truncateAtSentence(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  // Find last sentence boundary
  const lastDot = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('."'),
    truncated.lastIndexOf('."')
  );
  if (lastDot > maxLen * 0.4) {
    return truncated.slice(0, lastDot + 1).trim();
  }
  // Fallback: truncate at last space
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
    
    // Filter for HR-relevant items, but now include negative ones too (marked)
    return items.slice(0, 15).filter(i => {
      const full = `${i.title} ${i.description}`;
      if (source.name === 'HRnytt.se' && i.link?.includes('/event/')) return false;
      return isHRRelevant(full, source.name); // Allow negative news if HR-relevant
    }).map(i => {
      const full = `${i.title} ${i.description}`;
      return {
        title: i.title,
        summary: truncateAtSentence(i.description, 250) || i.title,
        source: source.name,
        source_url: i.link || null,
        category: categorize(full),
        published_at: i.pubDate,
        isNegative: isNegative(full), // Mark if negative
      };
    });
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
            content: `Du är en expert inom HR och rekrytering i Sverige. Din uppgift är att generera 4 FAKTA-BASERADE insikter och tips för rekryterare och HR-chefer.

VIKTIGA REGLER:
- Skriv ALDRIG om påhittade lagar, beslut eller nyheter
- Basera allt på BEVISADE fakta, forskning eller beprövad erfarenhet
- Fokusera på tidlösa, praktiska tips och insikter
- Använd formuleringar som "Studier visar att...", "Enligt forskning...", "Bästa praxis är att..."
- Alla påståenden ska vara sanna och verifierbara
- Skriv utförliga sammanfattningar med 3-4 meningar som ger konkret värde

EXEMPEL PÅ BRA INNEHÅLL:
- "Studier visar att strukturerade intervjuer ger 2x bättre träffsäkerhet"
- "Forskning: Snabb återkoppling till kandidater ökar acceptansgraden med 40%"
- "Tips: Kompetensbaserad rekrytering minskar felbeslut enligt flera studier"

Svara ENDAST med giltig JSON.`
          },
          {
            role: "user",
            content: `Generera 4 fakta-baserade HR-insikter i detta exakta JSON-format:
[
  {
    "title": "Kort rubrik max 80 tecken - börja gärna med 'Tips:', 'Forskning:' eller 'Insikt:'",
    "summary": "UTFÖRLIG sammanfattning på 3-4 meningar (ca 300-400 tecken). Beskriv insikten, förklara varför det är viktigt, och ge ett konkret tips eller exempel på hur man kan tillämpa det.",
    "category": "En av: Rekrytering, Ledarskap, HR-Tech, Arbetsmarknad, Trender"
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
      // Spread times: 0, 15, 35, 60 minutes ago
      const minutesAgo = [0, 15, 35, 60][idx] || idx * 20;
      const itemTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
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

    // Explicit test mode: generate AI backup without touching RSS items
    if (mode === 'ai') {
      console.log('Forced AI backup mode...');
      const aiNews = await generateAIFallbackNews(supabase);
      if (aiNews.length) {
        await supabase
          .from('daily_hr_news')
          .delete()
          .eq('source', 'Parium')
          .is('source_url', null);
        await supabase.from('daily_hr_news').insert(aiNews);
        return new Response(
          JSON.stringify({ message: 'AI backup generated', count: aiNews.length, source: 'ai' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ message: 'AI backup failed', count: 0, source: 'ai' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!force) {
      const { data } = await supabase
        .from('daily_hr_news')
        .select('id')
        .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
        .limit(1);
      if (data?.length)
        return new Response(JSON.stringify({ message: 'Fresh news exists', skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log('Fetching HR news...');
    const results = await Promise.all(RSS_SOURCES.map(fetchRSS));
    
    const seen = new Set<string>();
    let all = results.flat().filter(i => {
      // CRITICAL: Only keep articles WITH a valid published_at date
      if (!i.published_at) {
        console.log(`Filtered out (no date): "${i.title}" from ${i.source}`);
        return false;
      }
      const n = i.title.toLowerCase().replace(/[^a-zåäö0-9]/g, '').slice(0, 50);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
    
    // Sort by published_at (newest first) - all items now guaranteed to have dates
    all.sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
    
    // Separate positive and negative articles
    const positiveItems = all.filter(a => !a.isNegative);
    const negativeItems = all.filter(a => a.isNegative);
    
    console.log(`Found ${positiveItems.length} positive and ${negativeItems.length} negative HR articles`);
    
    // Balance sources - prioritize positive news
    const srcCount: Record<string, number> = {};
    const balanced: typeof all = [];
    
    // First add positive articles (max 2 per source)
    for (const a of positiveItems) {
      if ((srcCount[a.source] || 0) < 2) {
        balanced.push(a);
        srcCount[a.source] = (srcCount[a.source] || 0) + 1;
      }
      if (balanced.length >= 20) break;
    }
    
    // RULE: Maximum 1 negative article in the ENTIRE system at any time
    // Only add a negative article if:
    // 1. We don't have 4 articles yet
    // 2. There are NO negative articles currently in the database
    
    if (balanced.length < 4 && negativeItems.length > 0) {
      // Check if there's already a negative article in the database
      const { data: existingNegative } = await supabase
        .from('daily_hr_news')
        .select('id, title, summary')
        .not('source_url', 'is', null)
        .limit(20);
      
      // Check BOTH title AND summary against negative keywords
      const hasNegativeInDB = (existingNegative || []).some(article => {
        const fullText = `${article.title} ${article.summary || ''}`.toLowerCase();
        return NEGATIVE_KEYWORDS.some(k => fullText.includes(k));
      });
      
      if (hasNegativeInDB) {
        console.log(`Already have a negative article in DB, skipping new negative articles`);
      } else {
        // No negative in DB - we can add ONE
        console.log(`No negative in DB, can add 1 negative if needed`);
        const negToAdd = negativeItems.find(a => (srcCount[a.source] || 0) < 2);
        if (negToAdd && balanced.length < 4) {
          balanced.push(negToAdd);
          srcCount[negToAdd.source] = (srcCount[negToAdd.source] || 0) + 1;
          console.log(`Added 1 negative article: "${negToAdd.title}"`);
        }
      }
    }
    
    console.log(`Final selection: ${balanced.length} articles (${balanced.filter(a => a.isNegative).length} negative in batch)`);
    
    // Fetch existing RSS urls to de-duplicate
    const { data: existingRss } = await supabase
      .from('daily_hr_news')
      .select('source_url')
      .not('source_url', 'is', null)
      .limit(50);

    const existingUrls = new Set((existingRss || []).map((a: any) => a.source_url).filter(Boolean));
    const newItems = balanced.filter(i => !i.source_url || !existingUrls.has(i.source_url));

    // Delete old RSS articles only (not AI insights)
    await supabase
      .from('daily_hr_news')
      .delete()
      .not('source_url', 'is', null)
      .lt('news_date', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    const today = new Date().toISOString().split('T')[0];

    // Insert new RSS articles (if any)
    // NOTE: We intentionally insert MORE than 4 candidates here.
    // Reason: the final selection also enforces "max 2 per source".
    // If we only insert 4 and 3 are from the same source, the final balance step
    // would delete 1 and we'd end up showing only 3 items.
    let insertedRss = 0;
    if (newItems.length) {
      const insert = newItems.slice(0, 20).map((i, idx) => {
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

      await supabase.from('daily_hr_news').insert(insert);
      insertedRss = insert.length;
      console.log(`Inserted ${insertedRss} RSS articles`);
    }

    // Ensure we can always show 4 slots:
    // - Prefer real RSS items within the 5-day window
    // - Top up with AI only if we truly cannot reach 4
    const { data: poolAfterInsert } = await supabase
      .from('daily_hr_news')
      .select('id, source, source_url, published_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const pool = poolAfterInsert || [];

    // If fewer than 4 total items exist, top up with AI (incrementally)
    let aiAdded = 0;
    if (pool.length < 4) {
      const needed = 4 - pool.length;
      console.log(`Only ${pool.length} total items after expiry, topping up with ${needed} AI item(s)`);

      const aiNews = await generateAIFallbackNews(supabase);
      if (aiNews.length) {
        const oldestTs = pool.reduce((minTs: number, r: any) => {
          const t = r.published_at ? new Date(r.published_at).getTime() : Date.now();
          return Math.min(minTs, t);
        }, Date.now());

        // Place AI items as the OLDEST so real RSS never gets pushed away from the left
        const fillers = aiNews.slice(0, needed).map((item: any, idx: number) => ({
          ...item,
          news_date: today,
          order_index: pool.length + idx,
          published_at: new Date(oldestTs - (idx + 1) * 60 * 1000).toISOString(),
        }));

        await supabase.from('daily_hr_news').insert(fillers);
        aiAdded = fillers.length;
        console.log(`Inserted ${aiAdded} AI filler item(s)`);
      }
    }

    // Final enforce:
    // - Exactly 4 slots (always)
    // - Max 2 per *external* source (source_url != null)
    // - AI fillers (source_url == null) are allowed to fill remaining slots if needed
    const { data: finalItems1 } = await supabase
      .from('daily_hr_news')
      .select('id, source, source_url, category, published_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const finalList1 = finalItems1 || [];

    const pickBalanced = (list: any[]) => {
      const externalSourceCount: Record<string, number> = {};
      const selected: any[] = [];
      const keepIds = new Set<string>();

      for (const item of list) {
        if (selected.length >= 4) break;

        const isExternal = item.source_url != null;
        if (isExternal) {
          const count = externalSourceCount[item.source] || 0;
          if (count >= 2) continue;
          externalSourceCount[item.source] = count + 1;
        }

        selected.push(item);
        keepIds.add(item.id);
      }

      return { selected, keepIds };
    };

    let { selected: balancedFinal, keepIds } = pickBalanced(finalList1);

    // CRITICAL: Never allow <4 if we can top up with AI.
    // This fixes the scenario where we had 4 items, but source-balance trimmed one away.
    let aiAddedFinal = 0;
    if (balancedFinal.length < 4) {
      const needed = 4 - balancedFinal.length;
      console.log(`Final selection only ${balancedFinal.length} items after source balance, topping up with ${needed} AI item(s)`);

      const aiNews = await generateAIFallbackNews(supabase);
      if (aiNews.length) {
        const oldestTs = balancedFinal.reduce((minTs: number, r: any) => {
          const t = r.published_at ? new Date(r.published_at).getTime() : Date.now();
          return Math.min(minTs, t);
        }, Date.now());

        const fillers = aiNews.slice(0, needed).map((item: any, idx: number) => ({
          ...item,
          news_date: today,
          order_index: balancedFinal.length + idx,
          published_at: new Date(oldestTs - (idx + 1) * 60 * 1000).toISOString(),
        }));

        await supabase.from('daily_hr_news').insert(fillers);
        aiAddedFinal = fillers.length;
        console.log(`Inserted ${aiAddedFinal} final AI filler item(s)`);
      }

      // Re-read and re-pick after inserting AI fillers
      const { data: finalItems2 } = await supabase
        .from('daily_hr_news')
        .select('id, source, source_url, category, published_at')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(50);

      const finalList2 = finalItems2 || [];
      const repicked = pickBalanced(finalList2);
      balancedFinal = repicked.selected;
      keepIds = repicked.keepIds;
    }

    // Remove everything that's not part of the balanced final 4
    const allFinalIds = (await supabase
      .from('daily_hr_news')
      .select('id')
      .limit(200)).data || [];

    const idsToRemove = allFinalIds
      .map((r: any) => r.id)
      .filter((id: string) => !keepIds.has(id));

    if (idsToRemove.length > 0) {
      console.log(`Removing ${idsToRemove.length} items (final cleanup)`);
      await supabase.from('daily_hr_news').delete().in('id', idsToRemove);
    }

    const topSources = [...new Set(balancedFinal.map((i: any) => i.source))];
    const topCategories = [...new Set(balancedFinal.map((i: any) => i.category))];

    return new Response(
      JSON.stringify({
        message: 'HR news fetched successfully',
        rss_count: insertedRss,
        ai_added: aiAdded + aiAddedFinal,
        total_after: balancedFinal.length,
        sources: topSources,
        categories: topCategories,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('Fatal error in fetch-hr-news:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
