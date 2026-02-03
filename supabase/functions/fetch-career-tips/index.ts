// Career Tips Fetcher - Multi-source RSS with smart filtering for job seekers
// ROBUST VERSION: Same system as fetch-hr-news with retry-logic, health tracking and email-alerts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Swedish career-focused RSS sources (7 unique sources for job seekers)
// These are separate from HR-news sources to avoid duplication
const RSS_SOURCES = [
  // Career & work life focused
  { url: 'https://www.kollega.se/rss.xml', name: 'Kollega' },
  { url: 'https://www.unionen.se/rss.xml', name: 'Unionen' },
  { url: 'https://www.va.se/rss/', name: 'Veckans Affärer' },
  { url: 'https://arbetet.se/feed/', name: 'Arbetet' },
  { url: 'https://www.svt.se/nyheter/ekonomi/rss.xml', name: 'SVT Ekonomi' },
  { url: 'https://akademikern.se/feed/', name: 'Akademikern' },
  { url: 'https://www.ingenjoren.se/feed/', name: 'Ingenjören' },
];

// ONLY block completely irrelevant topics - politics, sports, entertainment, etc.
// We allow negative market news since it can be relevant context for job seekers
const BLOCKLIST = [
  // Geopolitics & war (not career related)
  'ukraina', 'ryssland', 'putin', 'gaza', 'israel', 'hamas', 'krig', 'invasion',
  // Politics & politicians
  'trump', 'biden', 'obama', 'erdogan', 'xi jinping', 'riksdag', 'statsminister', 
  'val 2026', 'regeringen', 'oppositionen', 'ministern',
  // Legal/criminal (not career advice)
  'stämmer', 'stämning', 'skadestånd', 'rättegång', 'domstol', 'åklagare', 
  'mord', 'brott', 'fängelse', 'häktad',
  // Crypto/speculation
  'bitcoin', 'ethereum', 'kryptovaluta', 'crypto', 'nft',
  // Sports
  'fotboll', 'hockey', 'allsvenskan', 'nhl', 'premier league', 'champions league', 
  'os 2026', 'vm ', 'elitserien', 'shl',
  // Entertainment
  'konsert', 'melodifestival', 'eurovision', 'netflix', 'spotify', 'film', 'artist',
  'grammy', 'oscar', 'hollywood',
  // Celebrities & royals
  'kungahuset', 'prinsessan', 'kronprinsen', 'kändis', 'celebrity',
  // Consumer/product news (not career related)
  'volvo bil', 'tesla bil', 'recension', 'test av', 'produkttest',
  // Pure finance (investment, not career)
  'aktiekurs', 'nasdaq', 'ipo', 'utdelning', 'aktietips'
];

// BROAD career-relevant keywords - article must match at least one
// Much more permissive than before to capture more relevant content
const CAREER_KEYWORDS = [
  // Core job seeking
  'jobb', 'arbete', 'anställ', 'rekryter', 'söka jobb', 'jobbsök', 'arbetssök',
  // CV & applications  
  'cv', 'ansökan', 'personligt brev', 'portfolio', 'meritförteckning',
  // Interviews
  'intervju', 'anställningsintervju', 'jobbintervju',
  // Career development
  'karriär', 'befordran', 'avancera', 'karriärväg', 'utveckling',
  // Salary & negotiation
  'lön', 'löneförhandl', 'lönesamtal', 'ersättning', 'förmåner',
  // Networking
  'nätverk', 'kontakt', 'linkedin', 'mentor', 'referens',
  // Skills & learning
  'kompetens', 'utbildning', 'kurs', 'certifiering', 'lära', 'kunskap',
  // Workplace & culture
  'arbetsplats', 'arbetsmiljö', 'arbetsgivare', 'chef', 'kollega', 'team',
  'distansarbete', 'hybrid', 'hemarbete', 'remote',
  // Work-life balance
  'work-life', 'balans', 'stress', 'välmående', 'hälsa på jobbet',
  // Job market trends (relevant even if negative)
  'arbetsmarknad', 'bransch', 'trend', 'efterfrågan', 'brist på',
  // Leadership (relevant for career growth)
  'ledarskap', 'chef', 'ledare', 'management',
  // Employment types
  'heltid', 'deltid', 'konsult', 'frilans', 'gig', 'sommarjobb', 'praktik',
  // Personal branding
  'personligt varumärke', 'profil', 'synlighet',
  // General work terms that indicate relevance
  'medarbetare', 'anställda', 'personal', 'hr', 'talent', 'rekrytering'
];

// Bonus keywords for prioritization (articles with these get higher ranking)
const PRIORITY_KEYWORDS = [
  'tips', 'råd', 'guide', 'så lyckas du', 'så får du', 'steg för steg',
  'hur du', 'bästa sättet', 'strategi', 'trick', 'hemlighet',
  'framgång', 'lyckas', 'öka dina chanser', 'förbättra'
];

const CATEGORIES = [
  { key: 'cv', label: 'CV & Ansökan', icon: 'FileText', gradient: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90', keywords: ['cv', 'personligt brev', 'ansökan', 'portfolio'] },
  { key: 'interview', label: 'Intervjutips', icon: 'MessageSquare', gradient: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90', keywords: ['intervju', 'frågor', 'förbereda', 'presentation'] },
  { key: 'networking', label: 'Nätverk', icon: 'Users', gradient: 'from-violet-500/90 via-purple-600/80 to-purple-700/90', keywords: ['nätverk', 'kontakt', 'linkedin', 'event', 'mentor'] },
  { key: 'salary', label: 'Lön & Förhandling', icon: 'Wallet', gradient: 'from-amber-500/90 via-orange-500/80 to-orange-600/90', keywords: ['lön', 'förhandl', 'erbjudande', 'bonus', 'villkor'] },
  { key: 'career', label: 'Karriärutveckling', icon: 'Rocket', gradient: 'from-cyan-500/90 via-sky-500/80 to-blue-600/90', keywords: ['karriär', 'utveckling', 'befordran', 'mål', 'kompetens'] },
  { key: 'market', label: 'Arbetsmarknad', icon: 'TrendingUp', gradient: 'from-rose-500/90 via-red-500/80 to-red-600/90', keywords: ['arbetsmarknad', 'trend', 'bransch', 'efterfrågan', 'varsel', 'rekryter'] },
  { key: 'workplace', label: 'Arbetsliv', icon: 'Building', gradient: 'from-slate-500/90 via-slate-600/80 to-slate-700/90', keywords: ['arbetsplats', 'miljö', 'kultur', 'kollega', 'chef', 'distans', 'hybrid'] },
];

// AI source identifier
const AI_SOURCE = 'Karriärcoach';

// Source limit constants
const MAX_PER_SOURCE_NORMAL = 2;  // Normal: max 2 articles per source
const MAX_PER_SOURCE_CRISIS = 3;  // Crisis mode: max 3 articles per source

// Retry configuration - SAME AS HR NEWS
const FETCH_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff
const FETCH_TIMEOUT = 12000; // 12 seconds

// Health tracking thresholds
const FAILURE_ALERT_THRESHOLD = 5; // Alert after 5 consecutive failures

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

// SMART FILTER for career tips - focused on RELEVANCE for job seekers
// Allows both positive and negative news as long as it's career-relevant
function isCareerRelevant(text: string): boolean {
  const t = text.toLowerCase();
  
  // 1. Block completely irrelevant topics (politics, sports, entertainment, etc.)
  if (BLOCKLIST.some(k => t.includes(k))) return false;
  
  // 2. Must contain at least one career-related keyword
  // This is the ONLY requirement now - much more permissive
  return CAREER_KEYWORDS.some(k => t.includes(k));
}

// Calculate relevance score for ranking - higher = more useful for job seekers
function getRelevanceScore(text: string): number {
  const t = text.toLowerCase();
  let score = 0;
  
  // Bonus points for actionable/tips keywords (most useful for job seekers)
  for (const keyword of PRIORITY_KEYWORDS) {
    if (t.includes(keyword)) score += 3;
  }
  
  // Extra points for multiple career keywords (more focused content)
  const careerMatches = CAREER_KEYWORDS.filter(k => t.includes(k)).length;
  score += careerMatches;
  
  return score;
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

// ============================================
// HEALTH TRACKING - SAME AS HR NEWS
// ============================================
async function updateSourceHealth(
  supabase: any,
  sourceName: string,
  sourceUrl: string,
  success: boolean,
  itemCount: number,
  errorMessage?: string
): Promise<void> {
  try {
    // Get current health record - use source_name + source_type as key
    const { data: existing } = await supabase
      .from('rss_source_health')
      .select('*')
      .eq('source_name', sourceName)
      .eq('source_type', 'career_tips')
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing record
      const newConsecutiveFailures = success ? 0 : (existing.consecutive_failures || 0) + 1;
      const shouldAlert = !success && 
                          newConsecutiveFailures >= FAILURE_ALERT_THRESHOLD && 
                          existing.consecutive_failures < FAILURE_ALERT_THRESHOLD;

      await supabase
        .from('rss_source_health')
        .update({
          is_healthy: success,
          last_check_at: now,
          last_success_at: success ? now : existing.last_success_at,
          last_failure_at: success ? existing.last_failure_at : now,
          consecutive_failures: newConsecutiveFailures,
          total_successes: (existing.total_successes || 0) + (success ? 1 : 0),
          total_failures: (existing.total_failures || 0) + (success ? 0 : 1),
          total_fetches: (existing.total_fetches || 0) + 1,
          successful_fetches: (existing.successful_fetches || 0) + (success ? 1 : 0),
          last_error: success ? null : errorMessage,
          last_error_message: success ? null : errorMessage,
          last_item_count: success ? itemCount : existing.last_item_count,
          updated_at: now,
        })
        .eq('id', existing.id);

      // Send alert if threshold reached
      if (shouldAlert) {
        console.log(`🚨 ALERT: ${sourceName} has failed ${newConsecutiveFailures} times consecutively!`);
        try {
          await supabase.functions.invoke('send-admin-alert', {
            body: {
              type: 'rss_source_failure',
              source_name: sourceName,
              source_type: 'career_tips',
              consecutive_failures: newConsecutiveFailures,
              last_error: errorMessage,
            }
          });
        } catch (alertErr) {
          console.error('Failed to send alert:', alertErr);
        }
      }
    } else {
      // Insert new record
      await supabase
        .from('rss_source_health')
        .insert({
          source_name: sourceName,
          source_url: sourceUrl,
          source_type: 'career_tips',
          is_healthy: success,
          last_check_at: now,
          last_success_at: success ? now : null,
          last_failure_at: success ? null : now,
          consecutive_failures: success ? 0 : 1,
          total_successes: success ? 1 : 0,
          total_failures: success ? 0 : 1,
          total_fetches: 1,
          successful_fetches: success ? 1 : 0,
          last_error: success ? null : errorMessage,
          last_error_message: success ? null : errorMessage,
          last_item_count: success ? itemCount : 0,
          is_active: true,
        });
    }
  } catch (e) {
    console.error(`Health tracking error for ${sourceName}:`, e);
  }
}

// ============================================
// FETCH WITH RETRY - SAME AS HR NEWS
// ============================================
async function fetchRSSWithRetry(
  source: { url: string; name: string },
  supabase: any
): Promise<FetchResult> {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      console.log(`[${source.name}] Attempt ${attempt}/${FETCH_RETRIES}...`);

      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Parium/1.0)',
          'Accept': 'application/rss+xml, text/xml, */*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        console.log(`[${source.name}] Failed with status ${response.status}`);
        if (attempt < FETCH_RETRIES) {
          await sleep(RETRY_DELAYS[attempt - 1]);
          continue;
        }
      } else {
        const xml = await response.text();
        const items = parseRSSItems(xml);
        
        // SMART FILTER: Career-relevant content for job seekers
        // Now more permissive - allows both positive and negative career news
        const relevantItems = items.slice(0, 25).filter(i => {
          const full = `${i.title} ${i.description}`;
          return isCareerRelevant(full);
        }).map(i => {
          const full = `${i.title} ${i.description}`;
          return {
            title: i.title,
            summary: truncateAtSentence(i.description, 250) || i.title,
            source: source.name,
            source_url: i.link || null,
            category: categorize(full),
            published_at: i.pubDate,
            relevanceScore: getRelevanceScore(full), // For sorting - higher = more actionable
          };
        })
        // SORT by relevance score - most actionable/useful content first
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

        console.log(`[${source.name}] ✓ Success: ${relevantItems.length} career-relevant items`);
        
        // Update health tracking
        await updateSourceHealth(supabase, source.name, source.url, true, relevantItems.length);
        
        return { items: relevantItems, success: true, attempts: attempt };
      }
    } catch (e: any) {
      const errorMsg = e.name === 'AbortError' ? 'Timeout' : e.message;
      lastError = errorMsg;
      console.log(`[${source.name}] Error on attempt ${attempt}: ${errorMsg}`);
      
      if (attempt < FETCH_RETRIES) {
        await sleep(RETRY_DELAYS[attempt - 1]);
      }
    }
  }

  console.log(`[${source.name}] ✗ Failed after ${FETCH_RETRIES} attempts: ${lastError}`);
  
  // Update health tracking with failure
  await updateSourceHealth(supabase, source.name, source.url, false, 0, lastError);
  
  return { items: [], success: false, error: lastError, attempts: FETCH_RETRIES };
}

// Generate a SINGLE AI tip (for gradual rotation)
async function generateSingleAITip(): Promise<any | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;
  
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
            content: `Du är en erfaren karriärcoach i Sverige. Generera ETT praktiskt karriärtips för jobbsökare.

VIKTIGA REGLER:
- Fokusera på PRAKTISKA, KONKRETA tips
- Skriv på svenska, positivt och uppmuntrande
- Basera på beprövad erfarenhet och forskning
- Skriv utförliga sammanfattningar med 3-4 meningar

Svara ENDAST med giltig JSON.`
          },
          {
            role: "user",
            content: `Generera 1 karriärtips i detta JSON-format:
{
  "title": "Kort rubrik max 60 tecken",
  "summary": "UTFÖRLIG sammanfattning på 3-4 meningar (ca 300-400 tecken).",
  "category": "En av: cv, interview, networking, salary, career, market"
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
    const catInfo = getCatInfo(item.category);
    const today = new Date().toISOString().split('T')[0];
    
    return {
      title: item.title,
      summary: item.summary,
      source: AI_SOURCE,
      source_url: null,
      category: catInfo.label,
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

// Generate multiple AI tips (for initial fill)
async function generateAITips(count: number = 4): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return [];
  
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
            content: `Du är en erfaren karriärcoach i Sverige. Generera ${count} PRAKTISKA karriärtips för jobbsökare.

VIKTIGA REGLER:
- Fokusera på PRAKTISKA, KONKRETA tips
- Skriv på svenska, positivt och uppmuntrande
- Basera på beprövad erfarenhet och forskning
- Skriv utförliga sammanfattningar med 3-4 meningar

Svara ENDAST med giltig JSON.`
          },
          {
            role: "user",
            content: `Generera ${count} karriärtips i detta JSON-format:
[
  {
    "title": "Kort rubrik max 60 tecken",
    "summary": "UTFÖRLIG sammanfattning på 3-4 meningar (ca 300-400 tecken).",
    "category": "En av: cv, interview, networking, salary, career, market"
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
    
    const tipsItems = JSON.parse(jsonMatch[0]);
    const today = new Date().toISOString().split('T')[0];
    
    return tipsItems.slice(0, count).map((item: any, idx: number) => {
      const catInfo = getCatInfo(item.category);
      const minutesAgo = [0, 15, 35, 60][idx] || idx * 20;
      const itemTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
      return {
        title: item.title,
        summary: item.summary,
        source: AI_SOURCE,
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

// ============================================
// HEALTH SUMMARY
// ============================================
async function getHealthSummary(supabase: any): Promise<any> {
  try {
    const { data } = await supabase
      .from('rss_source_health')
      .select('source_name, consecutive_failures, last_success_at, total_fetches, successful_fetches')
      .eq('source_type', 'career_tips')
      .eq('is_active', true);

    return data || [];
  } catch (e) {
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

    console.log('='.repeat(50));
    console.log('CAREER TIPS FETCH - START');
    console.log(`Mode: ${mode}, Force: ${force}`);
    console.log('='.repeat(50));

    // Explicit AI mode
    if (mode === 'ai') {
      console.log('Forced AI mode...');
      const aiTips = await generateAITips(4);
      if (aiTips.length) {
        await supabase.from('daily_career_tips').delete().eq('source', AI_SOURCE).is('source_url', null);
        await supabase.from('daily_career_tips').insert(aiTips);
        return new Response(
          JSON.stringify({ message: 'AI generated', count: aiTips.length, source: 'ai' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ message: 'AI failed', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Skip if we have fresh data
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

    console.log('Fetching career tips with retry logic...');

    // ===== STEP 1: Get current state =====
    const { data: currentItems } = await supabase
      .from('daily_career_tips')
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
      console.log(`Removing ${expiredRss.length} expired RSS items`);
      await supabase.from('daily_career_tips').delete().in('id', expiredRss.map(i => i.id));
    }

    // ===== STEP 3: Fetch new RSS items WITH RETRY LOGIC =====
    console.log(`Fetching from ${RSS_SOURCES.length} sources with retry logic...`);
    
    const fetchResults = await Promise.all(
      RSS_SOURCES.map(source => fetchRSSWithRetry(source, supabase))
    );
    
    // Calculate fetch statistics
    const successfulFetches = fetchResults.filter(r => r.success).length;
    const failedFetches = fetchResults.filter(r => !r.success).length;
    const totalAttempts = fetchResults.reduce((sum, r) => sum + r.attempts, 0);
    
    console.log(`Fetch results: ${successfulFetches}/${RSS_SOURCES.length} succeeded`);
    if (failedFetches > 0) {
      console.log(`Failed sources: ${fetchResults.filter(r => !r.success).map((r, i) => RSS_SOURCES[i].name).join(', ')}`);
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
      .from('daily_career_tips')
      .select('source_url')
      .not('source_url', 'is', null)
      .limit(100);

    const existingUrls = new Set((existingRss || []).map((a: any) => a.source_url).filter(Boolean));
    const newRssItems = allRss.filter(i => !i.source_url || !existingUrls.has(i.source_url));

    console.log(`Found ${newRssItems.length} new RSS items`);

    // ===== STEP 5: Get updated current state =====
    const { data: postCleanupItems } = await supabase
      .from('daily_career_tips')
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
      
      const { error: insertError } = await supabase.from('daily_career_tips').insert(insertData);
      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        insertedRss = insertData.length;
        console.log(`Successfully inserted ${insertedRss} new RSS items`);
      }
      
      // RSS-PRIORITERAD BORTTAGNING:
      // Hämta alla items, separera på typ, och ta bort i rätt ordning
      const { data: allItems } = await supabase
        .from('daily_career_tips')
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
          await supabase.from('daily_career_tips').delete().eq('id', id);
        }
        
        console.log(`Feed har nu exakt ${targetSlots} items (RSS prioriterat)`);
      }
    }

    // ===== STEP 7: Check if we need AI to fill slots =====
    const { data: afterRssItems } = await supabase
      .from('daily_career_tips')
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
      
      const aiTips = await generateAITips(aiNeeded);
      if (aiTips.length > 0) {
        const oldestTime = afterRss.reduce((min, r) => {
          const t = r.published_at ? new Date(r.published_at).getTime() : Date.now();
          return Math.min(min, t);
        }, Date.now());
        
        const fillers = aiTips.slice(0, aiNeeded).map((item, idx) => ({
          ...item,
          published_at: new Date(oldestTime - (idx + 1) * 60 * 1000).toISOString(),
        }));
        
        await supabase.from('daily_career_tips').insert(fillers);
        console.log(`Inserted ${fillers.length} AI filler items`);
      }
    } else if (afterAi.length > 0 && eligibleNewItems.length === 0) {
      // Daily AI refresh
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oldestAi = afterAi[afterAi.length - 1];
      
      if (oldestAi.created_at && new Date(oldestAi.created_at) < oneDayAgo) {
        console.log(`Refreshing oldest AI item (created ${oldestAi.created_at})`);
        
        const newAiItem = await generateSingleAITip();
        
        if (newAiItem) {
          await supabase.from('daily_career_tips').delete().eq('id', oldestAi.id);
          
          const rssItems = afterRss.filter(i => i.source_url != null);
          const oldestTime = rssItems.reduce((min, r) => {
            const t = r.published_at ? new Date(r.published_at).getTime() : Date.now();
            return Math.min(min, t);
          }, Date.now());
          
          await supabase.from('daily_career_tips').insert({
            ...newAiItem,
            published_at: new Date(oldestTime - 60 * 1000).toISOString(),
          });
          
          aiRefreshed = 1;
          console.log(`AI item refreshed`);
        }
      }
    }

    // ===== STEP 8: Final cleanup =====
    const { data: finalItems } = await supabase
      .from('daily_career_tips')
      .select('id, source, source_url, category')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const finalList = finalItems || [];
    
    if (finalList.length > targetSlots) {
      const toRemove = finalList.slice(targetSlots);
      console.log(`Removing ${toRemove.length} excess items`);
      await supabase.from('daily_career_tips').delete().in('id', toRemove.map(i => i.id));
    }

    const finalCount = Math.min(finalList.length, targetSlots);
    const finalSources = [...new Set(finalList.slice(0, targetSlots).map(i => i.source))];
    const finalSourceCounts = countBySource(finalList.slice(0, targetSlots));
    const finalCategories = [...new Set(finalList.slice(0, targetSlots).map(i => i.category))];

    // Get health summary
    const healthSummary = await getHealthSummary(supabase);

    console.log('='.repeat(50));
    console.log('CAREER TIPS FETCH - COMPLETE');
    console.log(`Result: ${finalCount} items, ${successfulFetches}/${RSS_SOURCES.length} sources OK`);
    console.log('='.repeat(50));

    return new Response(
      JSON.stringify({
        message: 'Career tips processed',
        rss_inserted: insertedRss,
        ai_replaced: aiReplaced,
        ai_refreshed: aiRefreshed,
        crisis_mode: crisisModeUsed,
        total: finalCount,
        sources: finalSources,
        source_counts: Object.fromEntries(finalSourceCounts),
        categories: finalCategories,
        fetch_stats: {
          total_sources: RSS_SOURCES.length,
          successful: successfulFetches,
          failed: failedFetches,
          total_attempts: totalAttempts,
        },
        health_summary: healthSummary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('Fatal error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
