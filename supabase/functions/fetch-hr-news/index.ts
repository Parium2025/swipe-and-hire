// HR News Fetcher - Multi-source RSS with smart filtering, retry logic, and health tracking
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRUSTED_SOURCES = ['HRnytt.se', 'Chef.se', 'Arbetsvärlden', 'DN Ekonomi', 'Expressen Ekonomi', 'Dagens Industri', 'Breakit'];

const RSS_SOURCES = [
  { url: 'https://hrnytt.se/feed/', name: 'HRnytt.se' },
  { url: 'https://www.chef.se/feed/', name: 'Chef.se' },
  { url: 'https://arbetsvarlden.se/feed/', name: 'Arbetsvärlden' },
  { url: 'https://www.dn.se/rss/ekonomi/', name: 'DN Ekonomi' },
  { url: 'https://www.di.se/rss', name: 'Dagens Industri' },
  { url: 'https://feeds.expressen.se/ekonomi', name: 'Expressen Ekonomi' },
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

// AI source identifier - used to identify AI-generated content
const AI_SOURCE = 'Parium';

// Source limit constants
const MAX_PER_SOURCE_NORMAL = 2;  // Normal: max 2 articles per source
const MAX_PER_SOURCE_CRISIS = 3;  // Crisis mode: max 3 articles per source

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in ms

// Health tracking thresholds
const CONSECUTIVE_FAILURES_ALERT = 5; // Alert after this many consecutive failures

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

// Decode HTML entities like &#8211; → – and &amp; → &
function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ');
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
    const title = decodeHtmlEntities(tm ? tm[1].trim() : '');
    
    let dm = c.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/is);
    if (!dm) dm = c.match(/<description>([^<]*)<\/description>/i);
    let desc = decodeHtmlEntities(dm ? dm[1].trim().replace(/<[^>]+>/g, '') : '');
    
    const lm = c.match(/<link>([^<]*)<\/link>/i) || c.match(/<guid[^>]*>([^<]*)<\/guid>/i);
    const link = lm ? lm[1].trim() : '';
    
    if (title.length > 10) items.push({ title, description: desc, link, pubDate });
  }
  return items;
}

function isHRRelevant(text: string, source: string): boolean {
  const t = text.toLowerCase();
  if (BLOCKLIST.some(k => t.includes(k))) return false;
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

// Count articles per source
function countBySource(items: { source: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.source, (counts.get(item.source) || 0) + 1);
  }
  return counts;
}

// Check if we can add an article from this source given current counts
function canAddFromSource(source: string, currentCounts: Map<string, number>, maxPerSource: number): boolean {
  const currentCount = currentCounts.get(source) || 0;
  return currentCount < maxPerSource;
}

// Filter new RSS items respecting source limits
function filterBySourceLimit(
  newItems: RSSItem[], 
  existingItems: { source: string }[], 
  maxPerSource: number
): RSSItem[] {
  const counts = countBySource(existingItems);
  const result: RSSItem[] = [];
  
  for (const item of newItems) {
    if (canAddFromSource(item.source, counts, maxPerSource)) {
      result.push(item);
      counts.set(item.source, (counts.get(item.source) || 0) + 1);
    }
  }
  
  return result;
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

interface FetchResult {
  items: RSSItem[];
  success: boolean;
  error?: string;
  attempts: number;
}

// Update RSS source health in database
async function updateSourceHealth(
  supabase: any,
  source: { url: string; name: string },
  success: boolean,
  errorMessage?: string
): Promise<{ shouldAlert: boolean; consecutiveFailures: number }> {
  try {
    // Try to get existing health record
    const { data: existing } = await supabase
      .from('rss_source_health')
      .select('*')
      .eq('source_name', source.name)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing record
      const updates: any = {
        is_healthy: success,
        updated_at: now,
      };

      if (success) {
        updates.last_success_at = now;
        updates.consecutive_failures = 0;
        updates.total_successes = (existing.total_successes || 0) + 1;
        updates.last_error_message = null;
      } else {
        updates.last_failure_at = now;
        updates.consecutive_failures = (existing.consecutive_failures || 0) + 1;
        updates.total_failures = (existing.total_failures || 0) + 1;
        updates.last_error_message = errorMessage || 'Unknown error';
      }

      await supabase
        .from('rss_source_health')
        .update(updates)
        .eq('source_name', source.name);

      return {
        shouldAlert: !success && updates.consecutive_failures >= CONSECUTIVE_FAILURES_ALERT,
        consecutiveFailures: updates.consecutive_failures,
      };
    } else {
      // Create new record
      await supabase.from('rss_source_health').insert({
        source_name: source.name,
        source_url: source.url,
        is_healthy: success,
        consecutive_failures: success ? 0 : 1,
        last_success_at: success ? now : null,
        last_failure_at: success ? null : now,
        last_error_message: success ? null : errorMessage,
        total_successes: success ? 1 : 0,
        total_failures: success ? 0 : 1,
      });

      return {
        shouldAlert: false,
        consecutiveFailures: success ? 0 : 1,
      };
    }
  } catch (e) {
    console.error(`Failed to update health for ${source.name}:`, e);
    return { shouldAlert: false, consecutiveFailures: 0 };
  }
}

// Fetch RSS with retry logic
async function fetchRSSWithRetry(
  source: { url: string; name: string },
  supabase: any
): Promise<FetchResult> {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const r = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Parium/1.0)',
          'Accept': 'application/rss+xml, text/xml, */*',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!r.ok) {
        lastError = `HTTP ${r.status}: ${r.statusText}`;
        if (attempt < MAX_RETRIES) {
          console.log(`Retry ${attempt}/${MAX_RETRIES} for ${source.name} after ${RETRY_DELAYS[attempt - 1]}ms...`);
          await sleep(RETRY_DELAYS[attempt - 1]);
          continue;
        }
        throw new Error(lastError);
      }
      
      const xml = await r.text();
      const items = parseRSSItems(xml);
      
      const rssItems = items.slice(0, 15).filter(i => {
        const full = `${i.title} ${i.description}`;
        if (source.name === 'HRnytt.se' && i.link?.includes('/event/')) return false;
        return isHRRelevant(full, source.name);
      }).map(i => {
        const full = `${i.title} ${i.description}`;
        return {
          title: i.title,
          summary: truncateAtSentence(i.description, 250) || i.title,
          source: source.name,
          source_url: i.link || null,
          category: categorize(full),
          published_at: i.pubDate,
          isNegative: isNegative(full),
        };
      });
      
      // Success - update health tracking
      await updateSourceHealth(supabase, source, true);
      
      return {
        items: rssItems,
        success: true,
        attempts: attempt,
      };
    } catch (e: any) {
      lastError = e.message || 'Unknown error';
      
      if (e.name === 'AbortError') {
        lastError = 'Request timeout (10s)';
      }
      
      if (attempt < MAX_RETRIES) {
        console.log(`Retry ${attempt}/${MAX_RETRIES} for ${source.name}: ${lastError}`);
        await sleep(RETRY_DELAYS[attempt - 1]);
      }
    }
  }
  
  // All retries failed - update health tracking
  const health = await updateSourceHealth(supabase, source, false, lastError);
  
  if (health.shouldAlert) {
    console.error(`⚠️ ALERT: ${source.name} has failed ${health.consecutiveFailures} times consecutively!`);
    
    // Send email alert to admin
    try {
      await supabase.functions.invoke('send-admin-alert', {
        body: {
          type: 'rss_source_failure',
          source_name: source.name,
          consecutive_failures: health.consecutiveFailures,
          error_message: lastError,
        },
      });
      console.log(`Alert email sent for ${source.name}`);
    } catch (alertErr) {
      console.error(`Failed to send alert email:`, alertErr);
    }
  }
  
  console.error(`Failed to fetch ${source.name} after ${MAX_RETRIES} attempts: ${lastError}`);
  
  return {
    items: [],
    success: false,
    error: lastError,
    attempts: MAX_RETRIES,
  };
}

// Generate a SINGLE AI news item (for gradual rotation)
async function generateSingleAINewsItem(): Promise<any | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return null;
  }
  
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
            content: `Du är en expert inom HR och rekrytering i Sverige. Generera EN fakta-baserad insikt för rekryterare.

VIKTIGA REGLER:
- Skriv ALDRIG om påhittade lagar eller nyheter
- Basera på BEVISADE fakta, forskning eller beprövad erfarenhet
- Fokusera på tidlösa, praktiska tips
- Skriv utförliga sammanfattningar med 3-4 meningar

Svara ENDAST med giltig JSON.`
          },
          {
            role: "user",
            content: `Generera 1 fakta-baserad HR-insikt i detta exakta JSON-format:
{
  "title": "Kort rubrik max 80 tecken - börja gärna med 'Tips:', 'Forskning:' eller 'Insikt:'",
  "summary": "UTFÖRLIG sammanfattning på 3-4 meningar (ca 300-400 tecken).",
  "category": "En av: Rekrytering, Ledarskap, HR-Tech, Arbetsmarknad, Trender"
}`
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const item = JSON.parse(jsonMatch[0]);
    const today = new Date().toISOString().split('T')[0];
    
    const categoryMap: Record<string, { icon: string; gradient: string }> = {
      'Rekrytering': { icon: 'UserPlus', gradient: 'from-violet-500/90 via-purple-600/80 to-purple-700/90' },
      'Ledarskap': { icon: 'Users', gradient: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90' },
      'HR-Tech': { icon: 'Cpu', gradient: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90' },
      'Arbetsmarknad': { icon: 'Briefcase', gradient: 'from-rose-500/90 via-red-500/80 to-red-600/90' },
      'Trender': { icon: 'TrendingUp', gradient: 'from-amber-500/90 via-orange-500/80 to-orange-600/90' },
    };
    
    const catInfo = categoryMap[item.category] || categoryMap['Trender'];
    
    return {
      title: item.title,
      summary: item.summary,
      source: AI_SOURCE,
      source_url: null,
      category: item.category,
      icon_name: catInfo.icon,
      gradient: catInfo.gradient,
      news_date: today,
      order_index: 0,
      published_at: new Date().toISOString(),
    };
  } catch (e) {
    console.error('AI generation error:', e);
    return null;
  }
}

// Generate multiple AI news items (for initial fill)
async function generateAIFallbackNews(count: number = 4): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return [];
  }
  
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
            content: `Du är en expert inom HR och rekrytering i Sverige. Generera ${count} FAKTA-BASERADE insikter för rekryterare.

VIKTIGA REGLER:
- Skriv ALDRIG om påhittade lagar eller nyheter
- Basera på BEVISADE fakta, forskning eller beprövad erfarenhet
- Fokusera på tidlösa, praktiska tips
- Skriv utförliga sammanfattningar med 3-4 meningar

Svara ENDAST med giltig JSON.`
          },
          {
            role: "user",
            content: `Generera ${count} fakta-baserade HR-insikter i detta exakta JSON-format:
[
  {
    "title": "Kort rubrik max 80 tecken",
    "summary": "UTFÖRLIG sammanfattning på 3-4 meningar (ca 300-400 tecken).",
    "category": "En av: Rekrytering, Ledarskap, HR-Tech, Arbetsmarknad, Trender"
  }
]`
          }
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    const newsItems = JSON.parse(jsonMatch[0]);
    const today = new Date().toISOString().split('T')[0];
    
    const categoryMap: Record<string, { icon: string; gradient: string }> = {
      'Rekrytering': { icon: 'UserPlus', gradient: 'from-violet-500/90 via-purple-600/80 to-purple-700/90' },
      'Ledarskap': { icon: 'Users', gradient: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90' },
      'HR-Tech': { icon: 'Cpu', gradient: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90' },
      'Arbetsmarknad': { icon: 'Briefcase', gradient: 'from-rose-500/90 via-red-500/80 to-red-600/90' },
      'Trender': { icon: 'TrendingUp', gradient: 'from-amber-500/90 via-orange-500/80 to-orange-600/90' },
    };
    
    return newsItems.slice(0, count).map((item: any, idx: number) => {
      const catInfo = categoryMap[item.category] || categoryMap['Trender'];
      const minutesAgo = [0, 15, 35, 60][idx] || idx * 20;
      const itemTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
      return {
        title: item.title,
        summary: item.summary,
        source: AI_SOURCE,
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

// Get health summary for response
async function getHealthSummary(supabase: any): Promise<any> {
  try {
    const { data } = await supabase
      .from('rss_source_health')
      .select('source_name, is_healthy, consecutive_failures, last_success_at, last_failure_at')
      .order('source_name');

    if (!data) return null;

    const unhealthySources = data.filter((s: any) => !s.is_healthy);
    const healthySources = data.filter((s: any) => s.is_healthy);

    return {
      total_sources: data.length,
      healthy: healthySources.length,
      unhealthy: unhealthySources.length,
      critical: data.filter((s: any) => s.consecutive_failures >= CONSECUTIVE_FAILURES_ALERT).map((s: any) => s.source_name),
    };
  } catch {
    return null;
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

    // Explicit AI mode - for testing only
    if (mode === 'ai') {
      console.log('Forced AI mode...');
      const aiNews = await generateAIFallbackNews(4);
      if (aiNews.length) {
        await supabase.from('daily_hr_news').delete().eq('source', AI_SOURCE).is('source_url', null);
        await supabase.from('daily_hr_news').insert(aiNews);
        return new Response(
          JSON.stringify({ message: 'AI generated', count: aiNews.length, source: 'ai' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ message: 'AI failed', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Skip if we have fresh data (unless forced)
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

    console.log('Fetching HR news with retry logic...');

    // ===== STEP 1: Get current state of the database =====
    const { data: currentItems } = await supabase
      .from('daily_hr_news')
      .select('id, source, source_url, published_at, created_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const current = currentItems || [];
    const currentRss = current.filter(i => i.source_url != null);
    const currentAi = current.filter(i => i.source_url == null);

    console.log(`Current state: ${currentRss.length} RSS, ${currentAi.length} AI`);

    // ===== STEP 2: Delete RSS items older than 5 days =====
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const expiredRss = currentRss.filter(i => i.published_at && new Date(i.published_at) < new Date(fiveDaysAgo));
    
    if (expiredRss.length > 0) {
      console.log(`Removing ${expiredRss.length} expired RSS items (older than 5 days)`);
      await supabase.from('daily_hr_news').delete().in('id', expiredRss.map(i => i.id));
    }

    // ===== STEP 3: Fetch new RSS items with retry logic =====
    const fetchResults = await Promise.all(
      RSS_SOURCES.map(source => fetchRSSWithRetry(source, supabase))
    );
    
    // Log fetch statistics
    const successfulFetches = fetchResults.filter(r => r.success).length;
    const failedFetches = fetchResults.filter(r => !r.success).length;
    const totalRetries = fetchResults.reduce((sum, r) => sum + (r.attempts - 1), 0);
    
    console.log(`Fetch results: ${successfulFetches}/${RSS_SOURCES.length} successful, ${totalRetries} retries used`);
    
    if (failedFetches > 0) {
      const failedSources = fetchResults
        .filter(r => !r.success)
        .map((r, i) => RSS_SOURCES[i].name);
      console.warn(`Failed sources: ${failedSources.join(', ')}`);
    }
    
    const seen = new Set<string>();
    let allRss = fetchResults.flatMap(r => r.items).filter(i => {
      if (!i.published_at) return false;
      const n = i.title.toLowerCase().replace(/[^a-zåäö0-9]/g, '').slice(0, 50);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
    
    allRss.sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());

    // ===== STEP 4: Check for existing URLs to de-duplicate =====
    const { data: existingRss } = await supabase
      .from('daily_hr_news')
      .select('source_url')
      .not('source_url', 'is', null)
      .limit(100);

    const existingUrls = new Set((existingRss || []).map((a: any) => a.source_url).filter(Boolean));
    const newRssItems = allRss.filter(i => !i.source_url || !existingUrls.has(i.source_url));

    console.log(`Found ${newRssItems.length} new RSS items (not already in DB)`);

    // ===== STEP 5: Get updated current state after expiry cleanup =====
    const { data: postCleanupItems } = await supabase
      .from('daily_hr_news')
      .select('id, source, source_url, published_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const postCleanup = postCleanupItems || [];
    const postCleanupRss = postCleanup.filter(i => i.source_url != null);
    const postCleanupAi = postCleanup.filter(i => i.source_url == null);

    console.log(`After cleanup: ${postCleanupRss.length} RSS, ${postCleanupAi.length} AI`);

    // ===== STEP 6: SIMPLE ROTATION LOGIC =====
    // Principle: Always keep exactly 4 articles, sorted by published_at
    // When new articles come in, add them and remove the oldest ones
    const today = new Date().toISOString().split('T')[0];
    let insertedRss = 0;
    let aiReplaced = 0;
    let aiRefreshed = 0;
    let crisisModeUsed = false;

    const targetSlots = 4;

    // Check if we're in crisis mode (need to allow more per source)
    const currentSourceCounts = countBySource(postCleanupRss);
    const availableNewWithLimit = filterBySourceLimit(newRssItems, postCleanupRss, MAX_PER_SOURCE_NORMAL);
    
    console.log(`Available new items with max 2/source limit: ${availableNewWithLimit.length}`);

    const potentialRssCount = postCleanupRss.length + availableNewWithLimit.length;
    const needsCrisisMode = potentialRssCount < targetSlots && newRssItems.length > availableNewWithLimit.length;
    
    if (needsCrisisMode) {
      console.log(`CRISIS MODE: Not enough unique sources, allowing max ${MAX_PER_SOURCE_CRISIS} per source`);
      crisisModeUsed = true;
    }

    const maxPerSource = needsCrisisMode ? MAX_PER_SOURCE_CRISIS : MAX_PER_SOURCE_NORMAL;
    const eligibleNewItems = filterBySourceLimit(newRssItems, postCleanupRss, maxPerSource);

    console.log(`Eligible new items with max ${maxPerSource}/source: ${eligibleNewItems.length}`);

    if (eligibleNewItems.length > 0) {
      // RSS-PRIORITERAD ROTATION:
      // 1. Nya RSS-artiklar läggs alltid in
      // 2. AI-artiklar raderas FÖRST för att göra plats
      // 3. Endast om inga AI finns kvar raderas äldsta RSS
      
      console.log(`Inserting ${eligibleNewItems.length} new RSS items...`);
      
      // Insert all eligible new items
      const insertData = eligibleNewItems.map((i, idx) => {
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
      
      const { error: insertError } = await supabase.from('daily_hr_news').insert(insertData);
      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        insertedRss = insertData.length;
        console.log(`Successfully inserted ${insertedRss} new RSS items`);
      }
      
      // RSS-PRIORITERAD BORTTAGNING:
      // Hämta alla items, separera på typ, och ta bort i rätt ordning
      const { data: allItems } = await supabase
        .from('daily_hr_news')
        .select('id, published_at, source, source_url')
        .order('published_at', { ascending: false, nullsFirst: false });
      
      if (allItems && allItems.length > targetSlots) {
        const excess = allItems.length - targetSlots;
        
        // Separera på typ
        const aiItems = allItems.filter(i => i.source_url == null);
        const rssItems = allItems.filter(i => i.source_url != null);
        
        // Sortera båda på published_at (äldst sist)
        aiItems.sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
        rssItems.sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
        
        const idsToDelete: string[] = [];
        let remaining = excess;
        
        // STEG 1: Ta bort AI-artiklar först (från äldst till nyast)
        const aiToDelete = aiItems.slice(-Math.min(remaining, aiItems.length));
        for (const item of aiToDelete) {
          idsToDelete.push(item.id);
          remaining--;
        }
        
        // STEG 2: Om det fortfarande behövs plats, ta bort äldsta RSS
        if (remaining > 0) {
          const rssToDelete = rssItems.slice(-remaining);
          for (const item of rssToDelete) {
            idsToDelete.push(item.id);
          }
        }
        
        aiReplaced = aiToDelete.length;
        const rssRemoved = idsToDelete.length - aiReplaced;
        
        console.log(`RSS-PRIORITERAD: Tar bort ${aiReplaced} AI + ${rssRemoved} äldsta RSS för att behålla ${targetSlots} totalt`);
        
        for (const id of idsToDelete) {
          await supabase.from('daily_hr_news').delete().eq('id', id);
        }
        
        console.log(`Feed har nu exakt ${targetSlots} items (RSS prioriterat)`);
      }
    }

    // ===== STEP 7: Check if we need AI to fill slots =====
    const { data: afterRssItems } = await supabase
      .from('daily_hr_news')
      .select('id, source, source_url, published_at, created_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const afterRss = afterRssItems || [];
    const afterRssCount = afterRss.filter(i => i.source_url != null).length;
    const afterAi = afterRss.filter(i => i.source_url == null);
    const totalAfterRss = afterRss.length;

    console.log(`After RSS processing: ${afterRssCount} RSS, ${afterAi.length} AI, total: ${totalAfterRss}`);

    if (totalAfterRss < targetSlots) {
      const aiNeeded = targetSlots - totalAfterRss;
      console.log(`Need ${aiNeeded} AI items to fill slots`);
      
      const aiNews = await generateAIFallbackNews(aiNeeded);
      if (aiNews.length > 0) {
        const oldestTime = afterRss.reduce((min, r) => {
          const t = r.published_at ? new Date(r.published_at).getTime() : Date.now();
          return Math.min(min, t);
        }, Date.now());
        
        const fillers = aiNews.slice(0, aiNeeded).map((item, idx) => ({
          ...item,
          published_at: new Date(oldestTime - (idx + 1) * 60 * 1000).toISOString(),
        }));
        
        await supabase.from('daily_hr_news').insert(fillers);
        console.log(`Inserted ${fillers.length} AI filler items`);
      }
    } else if (afterAi.length > 0 && eligibleNewItems.length === 0) {
      // ===== STEP 8: Daily AI refresh =====
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oldestAi = afterAi[afterAi.length - 1];
      
      if (oldestAi.created_at && new Date(oldestAi.created_at) < oneDayAgo) {
        console.log(`Refreshing oldest AI item (created ${oldestAi.created_at})`);
        
        const newAiItem = await generateSingleAINewsItem();
        
        if (newAiItem) {
          await supabase.from('daily_hr_news').delete().eq('id', oldestAi.id);
          
          const rssItems = afterRss.filter(i => i.source_url != null);
          const oldestTime = rssItems.reduce((min, r) => {
            const t = r.published_at ? new Date(r.published_at).getTime() : Date.now();
            return Math.min(min, t);
          }, Date.now());
          
          await supabase.from('daily_hr_news').insert({
            ...newAiItem,
            published_at: new Date(oldestTime - 60 * 1000).toISOString(),
          });
          
          aiRefreshed = 1;
          console.log(`AI item refreshed`);
        }
      }
    }

    // ===== STEP 9: Final cleanup =====
    const { data: finalItems } = await supabase
      .from('daily_hr_news')
      .select('id, source, source_url, category')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const finalList = finalItems || [];
    
    if (finalList.length > targetSlots) {
      const toRemove = finalList.slice(targetSlots);
      console.log(`Removing ${toRemove.length} excess items`);
      await supabase.from('daily_hr_news').delete().in('id', toRemove.map(i => i.id));
    }

    const finalCount = Math.min(finalList.length, targetSlots);
    const finalSources = [...new Set(finalList.slice(0, targetSlots).map(i => i.source))];
    const finalSourceCounts = countBySource(finalList.slice(0, targetSlots));
    const finalCategories = [...new Set(finalList.slice(0, targetSlots).map(i => i.category))];

    // Get health summary
    const healthSummary = await getHealthSummary(supabase);

    return new Response(
      JSON.stringify({
        message: 'HR news processed',
        rss_inserted: insertedRss,
        ai_replaced: aiReplaced,
        ai_refreshed: aiRefreshed,
        crisis_mode: crisisModeUsed,
        total: finalCount,
        sources: finalSources,
        source_counts: Object.fromEntries(finalSourceCounts),
        categories: finalCategories,
        fetch_stats: {
          successful: successfulFetches,
          failed: failedFetches,
          total_retries: totalRetries,
        },
        health: healthSummary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('Fatal error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
