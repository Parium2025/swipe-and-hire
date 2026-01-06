// HR News Fetcher - Multi-source RSS with AI enhancement (FREE, no external API keys needed)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RSS sources - focused on HR, recruitment, leadership, labor market, salary, career & business
// TRUSTED_SOURCES get automatic pass without strict keyword filtering
const TRUSTED_HR_SOURCES = [
  // Swedish HR (verified working)
  'HRnytt.se', 'Chef.se', 'Arbetsvärlden',
  // Swedish news/economy (verified working)
  'DN Ekonomi', 'Expressen Ekonomi', 'Dagens Industri',
  // International HR (verified working)
  'HR Dive', 'HR Executive', 'AIHR', 'Personnel Today',
  // Business/Career (verified working)
  'Fast Company', 'Inc.'
];

const RSS_SOURCES = [
  // === SWEDISH HR & RECRUITMENT (VERIFIED WORKING) ===
  { url: 'https://hrnytt.se/feed/', name: 'HRnytt.se' },
  { url: 'https://www.chef.se/feed/', name: 'Chef.se' },
  { url: 'https://arbetsvarlden.se/feed/', name: 'Arbetsvärlden' },
  
  // === SWEDISH MAJOR NEWS - ECONOMY (VERIFIED WORKING) ===
  { url: 'https://www.dn.se/rss/ekonomi/', name: 'DN Ekonomi' },
  { url: 'https://www.di.se/rss', name: 'Dagens Industri' },
  { url: 'https://feeds.expressen.se/ekonomi', name: 'Expressen Ekonomi' },
  
  // === INTERNATIONAL HR (VERIFIED WORKING) ===
  { url: 'https://www.hrdive.com/feeds/news/', name: 'HR Dive' },
  { url: 'https://hrexecutive.com/feed/', name: 'HR Executive' },
  { url: 'https://www.aihr.com/feed/', name: 'AIHR' },
  { url: 'https://www.personneltoday.com/feed/', name: 'Personnel Today' },
  
  // === CAREER & BUSINESS (VERIFIED WORKING - high volume) ===
  { url: 'https://www.fastcompany.com/rss', name: 'Fast Company' },
  { url: 'https://www.inc.com/rss', name: 'Inc.' },
];

// Keywords to filter out truly negative/scandal content (not labor market statistics)
// NOTE: 'strejk' (strike) is ALLOWED since it's labor market relevant
const NEGATIVE_KEYWORDS = [
  'skandal', 'misslyck', 'konflikt', 'döm', 
  'åtal', 'brott', 'svek', 'fusk', 'bedrägeri', 'diskriminer',
  'mobbing', 'trakasser', 'hot', 'våld'
];

// Keywords that indicate HR-relevant content (at least 1 must match)
const HR_RELEVANCE_KEYWORDS = [
  // Core HR terms
  'hr', 'rekryter', 'anställ', 'personal', 'medarbetar', 'arbetsplats', 'arbetsmiljö',
  'arbetsgivare', 'arbetstagare', 'arbetsmarknad', 'arbetsrätt', 'arbetsliv',
  // Leadership & Management
  'chef', 'ledar', 'ledning', 'team', 'organisation', 'företagskultur', 'vd', 'ceo',
  // Talent & Competence
  'talent', 'kompetens', 'utbildning', 'utveckling', 'karriär', 'lön', 'förmån',
  // Hiring process
  'kandidat', 'intervju', 'urval', 'onboarding', 'offboarding', 'cv', 'jobbansök',
  // Modern workplace
  'hybridarbete', 'distansarbete', 'hemarbete', 'flexibel', 'work-life',
  // HR Tech
  'hr-tech', 'hrtech', 'ats', 'hris', 'lms',
  // Wellbeing & motivation
  'trivsel', 'engagemang', 'motivation', 'välmående', 'balans', 'stress', 'utbrändhet',
  // Employment types
  'heltid', 'deltid', 'konsult', 'vikarie', 'provanställ',
  // Labor market & employment
  'arbetslöshet', 'arbetslös', 'sysselsättning', 'jobbmarknad', 'varsel', 'uppsägning',
  'kollektivavtal', 'fackförening', 'fack', 'unionen', 'tjänstemän', 'neddragning',
  // Salary & compensation
  'lön', 'löneökning', 'lönerevision', 'bonus', 'ersättning', 'pension', 'förmåner',
  'salary', 'compensation', 'pay', 'benefits', 'wages',
  // Career & self-development
  'karriär', 'befordran', 'utveckling', 'ledarskap', 'coaching', 'mentor',
  'self-improvement', 'productivity', 'skills', 'growth', 'success',
  // Business & economy (labor market angle)
  'nyanställ', 'rekord', 'tillväxt', 'expansion', 'konkurs', 'omstrukturering',
  'layoff', 'hiring', 'workforce', 'employees', 'jobs', 'employment'
];

// BLOCKLIST - only truly irrelevant topics (NOT labor market related!)
const BLOCKLIST_KEYWORDS = [
  // === GEOPOLITICS & WAR (pure politics, not labor) ===
  'ukraina', 'ryssland', 'putin', 'zelensky', 'invasion', 'missile',
  'nato', 'militär', 'vapen', 'trupper', 'bombning', 'anfall',
  'gaza', 'israel', 'hamas', 'mellanöstern', 'syrien', 'iran', 'taiwan',
  'beijing', 'trump', 'biden', 'vita huset', 'kongress',
  
  // === CRYPTO & PURE FINANCE ===
  'kryptovaluta', 'bitcoin', 'ethereum', 'börskurs', 'aktiekurs',
  'nvidia', 'amd', 'intel', 'aktieanalys', 'börsras',
  
  // === ENVIRONMENTAL DISASTERS & ACCIDENTS (not HR-related) ===
  'oljespill', 'oljeutsläpp', 'mexikanska golfen', 'oil spill', 'oil leak',
  'texas-företag', 'miljöbrott', 'utsläpp',
  
  // === SPORTS ===
  'fotboll', 'hockey', 'match', 'liga', 'mästerskap', 'allsvensk',
  'premier league', 'champions league',
  
  // === ENTERTAINMENT ===
  'konsert', 'artist', 'kändis', 'hollywood', 'grammy', 'oscar',
  'melodifestival', 'eurovision',
  
  // === DISASTERS & CRIME ===
  'jordbävning', 'tsunami', 'orkan', 'översvämning',
];

// Categories with their styling
const CATEGORIES = [
  { 
    key: 'labor_market', 
    label: 'Arbetsmarknad',
    icon: 'Briefcase',
    gradient: 'from-rose-500/90 via-red-500/80 to-red-600/90',
    keywords: ['arbetslös', 'varsel', 'uppsägning', 'neddragning', 'konkurs', 'layoff', 'unemployment', 'sysselsättning', 'jobbmarknad', 'arbetsförmedling']
  },
  { 
    key: 'salary', 
    label: 'Lön & Förmåner',
    icon: 'Wallet',
    gradient: 'from-green-500/90 via-emerald-500/80 to-emerald-600/90',
    keywords: ['lön', 'löneökning', 'lönerevision', 'bonus', 'ersättning', 'pension', 'förmån', 'salary', 'compensation', 'pay', 'benefits', 'wages']
  },
  { 
    key: 'career', 
    label: 'Karriär & Utveckling',
    icon: 'Rocket',
    gradient: 'from-cyan-500/90 via-sky-500/80 to-blue-600/90',
    keywords: ['karriär', 'befordran', 'utveckling', 'coaching', 'mentor', 'utbildning', 'kompetens', 'skills', 'growth', 'productivity', 'success']
  },
  { 
    key: 'hr_tech', 
    label: 'HR-Tech',
    icon: 'Cpu',
    gradient: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90',
    keywords: ['ai', 'tech', 'digital', 'verktyg', 'automatiser', 'system', 'program', 'robot', 'chatbot', 'plattform', 'innovation']
  },
  { 
    key: 'trends', 
    label: 'Trender',
    icon: 'TrendingUp',
    gradient: 'from-amber-500/90 via-orange-500/80 to-orange-600/90',
    keywords: ['trend', 'framtid', '2026', '2025', 'förändring', 'arbetsmarknad', 'statistik', 'ökning', 'tillväxt']
  },
  { 
    key: 'leadership', 
    label: 'Ledarskap',
    icon: 'Users',
    gradient: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90',
    keywords: ['ledar', 'chef', 'team', 'medarbetar', 'förebild', 'kultur', 'motivation', 'feedback', 'arbetsmiljö', 'engagemang']
  },
  { 
    key: 'recruitment', 
    label: 'Rekrytering',
    icon: 'UserPlus',
    gradient: 'from-violet-500/90 via-purple-600/80 to-purple-700/90',
    keywords: ['rekryter', 'kandidat', 'anställ', 'intervju', 'urval', 'onboarding', 'talent', 'jobb', 'hiring']
  },
  { 
    key: 'business', 
    label: 'Näringsliv',
    icon: 'Building2',
    gradient: 'from-slate-500/90 via-gray-600/80 to-zinc-700/90',
    keywords: ['bolag', 'företag', 'vd', 'ceo', 'resultat', 'vinst', 'förlust', 'expansion', 'omstrukturering', 'tillväxt', 'nyanställ']
  },
];

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  source_url: string | null;
  category: string;
  published_at: string | null;
  is_translated?: boolean;
}

// Check if a date is within the last 5 days (120 hours) - covers Monday-Friday work week
function isWithin5Days(dateStr: string): boolean {
  try {
    const pubDate = new Date(dateStr);
    if (isNaN(pubDate.getTime())) return false;
    
    const now = new Date();
    const hoursDiff = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 120; // 5 days * 24 hours
  } catch {
    return false;
  }
}

// Parse RSS XML to extract news items (only from last 48 hours)
function parseRSSItems(xml: string): { title: string; description: string; link: string; pubDate: string | null }[] {
  const items: { title: string; description: string; link: string; pubDate: string | null }[] = [];
  
  // Extract <item> blocks
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  
  for (const match of itemMatches) {
    const itemContent = match[1];
    
    // Extract pubDate - try multiple formats (some RSS feeds use different tags or CDATA)
    let pubDate: string | null = null;
    
    // Try standard pubDate
    let pubDateMatch = itemContent.match(/<pubDate><!\[CDATA\[(.*?)\]\]><\/pubDate>/i);
    if (!pubDateMatch) pubDateMatch = itemContent.match(/<pubDate>([^<]*)<\/pubDate>/i);
    if (!pubDateMatch) pubDateMatch = itemContent.match(/<dc:date>([^<]*)<\/dc:date>/i);
    if (!pubDateMatch) pubDateMatch = itemContent.match(/<published>([^<]*)<\/published>/i);
    if (!pubDateMatch) pubDateMatch = itemContent.match(/<updated>([^<]*)<\/updated>/i);
    // WordPress uses wp:post_date
    if (!pubDateMatch) pubDateMatch = itemContent.match(/<wp:post_date>([^<]*)<\/wp:post_date>/i);
    
    if (pubDateMatch) {
      pubDate = pubDateMatch[1].trim();
    }
    
    // Skip articles older than 5 days (only if we have a valid date)
    if (pubDate && !isWithin5Days(pubDate)) {
      continue;
    }
    
    // Extract title - handle CDATA
    let titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i);
    if (!titleMatch) {
      titleMatch = itemContent.match(/<title>([^<]*)<\/title>/i);
    }
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract description - handle CDATA
    let descMatch = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/is);
    if (!descMatch) {
      descMatch = itemContent.match(/<description>([^<]*)<\/description>/i);
    }
    let description = descMatch ? descMatch[1].trim() : '';
    // Clean HTML tags from description
    description = description.replace(/<[^>]+>/g, '').trim();
    
    // Extract link - handle both formats
    const linkMatch = itemContent.match(/<link>([^<]*)<\/link>/i) || 
                      itemContent.match(/<link[^>]*href="([^"]+)"/i) ||
                      itemContent.match(/<guid[^>]*>([^<]*)<\/guid>/i);
    const link = linkMatch ? linkMatch[1].trim() : '';
    
    if (title && title.length > 10) {
      items.push({ title, description, link, pubDate });
    }
  }
  
  return items;
}

// Check if content is HR-relevant
// Trusted sources get automatic pass, others need keyword matches
function isHRRelevant(text: string, sourceName: string): boolean {
  const lowerText = text.toLowerCase();
  
  // First check blocklist - if any match, reject immediately
  if (BLOCKLIST_KEYWORDS.some(keyword => lowerText.includes(keyword))) {
    return false;
  }
  
  // Trusted HR sources: auto-pass (they're dedicated HR publications)
  if (TRUSTED_HR_SOURCES.includes(sourceName)) {
    return true;
  }
  
  // For general news sources: require at least 1 HR keyword
  const matchCount = HR_RELEVANCE_KEYWORDS.filter(keyword => lowerText.includes(keyword)).length;
  return matchCount >= 1;
}

// Check if content contains negative keywords
function isNegativeContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return NEGATIVE_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

// Scrape publication date from HRnytt.se article page
async function scrapeHRnyttDate(articleUrl: string): Promise<string | null> {
  try {
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Parium/1.0)',
        'Accept': 'text/html',
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Swedish months for parsing
    const swedishMonths: Record<string, number> = {
      'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
      'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11
    };
    
    // PRIORITY 1: Look for "PUBLICERAD" text followed by date (HRnytt.se specific pattern)
    // Format: "PUBLICERAD 19/12/2025" or "PUBLICERAD 19 december 2025"
    const publicedMatch = html.match(/PUBLICERAD\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
    if (publicedMatch) {
      const day = parseInt(publicedMatch[1]);
      const month = parseInt(publicedMatch[2]) - 1; // 0-indexed
      const year = parseInt(publicedMatch[3]);
      const date = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(date.getTime())) {
        console.log(`Found PUBLICERAD date: ${date.toISOString()}`);
        return date.toISOString();
      }
    }
    
    // PRIORITY 2: "PUBLICERAD" followed by Swedish month format
    const publicedSwedishMatch = html.match(/PUBLICERAD\s*(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{4})/i);
    if (publicedSwedishMatch) {
      const day = parseInt(publicedSwedishMatch[1]);
      const month = swedishMonths[publicedSwedishMatch[2].toLowerCase()];
      const year = parseInt(publicedSwedishMatch[3]);
      const date = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(date.getTime())) {
        console.log(`Found PUBLICERAD Swedish date: ${date.toISOString()}`);
        return date.toISOString();
      }
    }
    
    // PRIORITY 3: Meta tag (reliable, set by CMS)
    const metaMatch = html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i) ||
                      html.match(/<meta[^>]*content="([^"]+)"[^>]*property="article:published_time"/i);
    if (metaMatch) {
      const date = new Date(metaMatch[1]);
      if (!isNaN(date.getTime())) {
        console.log(`Found date via meta tag: ${date.toISOString()}`);
        return date.toISOString();
      }
    }
    
    // PRIORITY 4: <time datetime> (usually in article header, not body)
    const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"/i);
    if (timeMatch) {
      const date = new Date(timeMatch[1]);
      if (!isNaN(date.getTime())) {
        console.log(`Found date via <time>: ${date.toISOString()}`);
        return date.toISOString();
      }
    }
    
    // DO NOT use generic date patterns from article body - they catch event dates!
    
    return null;
  } catch (error) {
    console.log(`Failed to scrape date from ${articleUrl}:`, error);
    return null;
  }
}

// Cache for existing article dates (source_url -> published_at)
let existingArticleDates: Map<string, string | null> = new Map();

// Load existing article dates from database for caching
async function loadExistingArticleDates(supabase: any): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('daily_hr_news')
      .select('source_url, published_at')
      .not('source_url', 'is', null);
    
    if (error) {
      console.log('Failed to load cached dates:', error.message);
      return;
    }
    
    existingArticleDates = new Map();
    for (const article of data || []) {
      if (article.source_url) {
        existingArticleDates.set(article.source_url, article.published_at);
      }
    }
    console.log(`Loaded ${existingArticleDates.size} cached article dates`);
  } catch (err) {
    console.log('Error loading cached dates:', err);
  }
}

// Get cached date or scrape if needed
async function getCachedOrScrapedDate(articleUrl: string, sourceName: string): Promise<string | null> {
  // Check cache first
  if (existingArticleDates.has(articleUrl)) {
    const cachedDate = existingArticleDates.get(articleUrl);
    if (cachedDate) {
      console.log(`Using cached date for: ${articleUrl}`);
      return cachedDate;
    }
  }
  
  // Only scrape for HRnytt.se
  if (sourceName === 'HRnytt.se') {
    console.log(`Scraping date from HRnytt article: ${articleUrl}`);
    return await scrapeHRnyttDate(articleUrl);
  }
  
  return null;
}

// Fetch news from a single RSS source
async function fetchRSSSource(source: { url: string; name: string }): Promise<NewsItem[]> {
  try {
    console.log(`Fetching ${source.name}...`);
    
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Parium/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    
    if (!response.ok) {
      console.log(`${source.name} returned ${response.status}`);
      return [];
    }
    
    const xml = await response.text();
    const rssItems = parseRSSItems(xml);
    console.log(`Parsed ${rssItems.length} items from ${source.name}`);
    
    const newsItems: NewsItem[] = [];
    
    for (const item of rssItems.slice(0, 15)) { // Check more items to find relevant ones
      const fullText = `${item.title} ${item.description}`;
      
      // Skip event pages from HRnytt.se (they have /event/ in URL and show future dates)
      if (source.name === 'HRnytt.se' && item.link && item.link.includes('/event/')) {
        console.log(`Skipping HRnytt event: ${item.title.slice(0, 40)}...`);
        continue;
      }
      
      // Skip non-HR content (pass source name for trusted source check)
      if (!isHRRelevant(fullText, source.name)) {
        console.log(`Skipping non-HR: ${item.title.slice(0, 40)}...`);
        continue;
      }
      
      // Skip negative content
      if (isNegativeContent(fullText)) {
        console.log(`Skipping negative: ${item.title.slice(0, 40)}...`);
        continue;
      }
      
      // Categorize based on title and description
      const searchText = fullText.toLowerCase();
      let category = 'trends';
      
      for (const cat of CATEGORIES) {
        if (cat.keywords.some(keyword => searchText.includes(keyword))) {
          category = cat.key;
          break;
        }
      }
      
      // For HRnytt.se without pubDate in RSS, try to scrape from article page
      let pubDate = item.pubDate;
      if (!pubDate && source.name === 'HRnytt.se' && item.link) {
        pubDate = await getCachedOrScrapedDate(item.link, source.name);
      }
      
      newsItems.push({
        title: item.title,
        summary: item.description.slice(0, 400) || item.title,
        source: source.name,
        source_url: item.link || null,
        category,
        published_at: pubDate,
        is_translated: false,
      });
    }
    
    console.log(`${source.name}: ${newsItems.length} HR-relevant items`);
    return newsItems;
  } catch (error) {
    console.error(`Error fetching ${source.name}:`, error);
    return [];
  }
}

// Simple AI-based translation using free Gemini API (via Lovable Cloud)
async function translateToSwedish(text: string): Promise<string> {
  try {
    // Use Lovable's built-in AI endpoint for translation
    const response = await fetch('https://jrjaegapuujushsiofoi.supabase.co/functions/v1/generate-cv-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        mode: 'translate',
        text: text,
        targetLanguage: 'Swedish'
      }),
    });
    
    if (!response.ok) {
      console.log('Translation API failed, returning original text');
      return text;
    }
    
    const result = await response.json();
    return result.translation || text;
  } catch (error) {
    console.log('Translation error:', error);
    return text;
  }
}

// Detect if text is English (simple heuristic)
function isEnglish(text: string): boolean {
  const englishWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'her', 'was', 'one', 'our', 'out', 'how', 'why', 'who', 'get', 'when', 'make', 'like', 'time', 'just', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'them', 'work', 'life', 'well', 'only', 'need'];
  const swedishWords = ['och', 'att', 'det', 'som', 'för', 'med', 'har', 'inte', 'den', 'kan', 'ett', 'vara', 'på', 'av', 'till', 'är', 'från', 'eller', 'om', 'sig', 'de', 'vi', 'efter', 'vid'];
  
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  const englishCount = words.filter(w => englishWords.includes(w)).length;
  const swedishCount = words.filter(w => swedishWords.includes(w)).length;
  
  return englishCount > swedishCount && englishCount >= 2;
}

// Get category styling info
function getCategoryInfo(categoryKey: string) {
  return CATEGORIES.find(c => c.key === categoryKey) || CATEGORIES.find(c => c.key === 'trends')!;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check for force refresh parameter
    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.force === true;
    const testSources = body.testSources === true;
    
    // Test mode: just verify which RSS sources work
    if (testSources) {
      console.log('=== TESTING RSS SOURCES ===');
      const results: { name: string; status: string; articleCount: number; error?: string }[] = [];
      
      for (const source of RSS_SOURCES) {
        try {
          const response = await fetch(source.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Parium/1.0)',
              'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
          });
          
          if (!response.ok) {
            results.push({ name: source.name, status: 'error', articleCount: 0, error: `HTTP ${response.status}` });
            continue;
          }
          
          const xml = await response.text();
          const items = parseRSSItems(xml);
          results.push({ name: source.name, status: 'ok', articleCount: items.length });
        } catch (error) {
          results.push({ name: source.name, status: 'error', articleCount: 0, error: String(error) });
        }
      }
      
      console.log('=== SOURCE TEST RESULTS ===');
      for (const r of results) {
        console.log(`${r.name}: ${r.status} (${r.articleCount} articles)${r.error ? ` - ${r.error}` : ''}`);
      }
      
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Check if we already have fresh news (within last 4 hours)
    if (!forceRefresh) {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: existingNews } = await supabase
        .from('daily_hr_news')
        .select('id')
        .gte('created_at', fourHoursAgo)
        .limit(1);
      
      if (existingNews && existingNews.length > 0) {
        console.log('Fresh news exists, skipping fetch');
        return new Response(JSON.stringify({ message: 'Fresh news exists', skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    console.log('Starting HR news fetch from multiple sources...');
    
    // Load existing article dates for caching
    await loadExistingArticleDates(supabase);
    
    // Fetch from all sources in parallel
    const allNewsPromises = RSS_SOURCES.map(source => fetchRSSSource(source));
    const allNewsResults = await Promise.all(allNewsPromises);
    
    // Flatten and deduplicate by title similarity
    let allNews: NewsItem[] = [];
    const seenTitles = new Set<string>();
    
    for (const sourceNews of allNewsResults) {
      for (const item of sourceNews) {
        // Simple dedup by normalized title
        const normalizedTitle = item.title.toLowerCase().replace(/[^a-zåäö0-9]/g, '').slice(0, 50);
        if (!seenTitles.has(normalizedTitle)) {
          seenTitles.add(normalizedTitle);
          allNews.push(item);
        }
      }
    }
    
    console.log(`Total unique articles: ${allNews.length}`);
    
    // Sort by publication date (newest first), then by source priority
    allNews.sort((a, b) => {
      // First, sort by date
      if (a.published_at && b.published_at) {
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      }
      if (a.published_at) return -1;
      if (b.published_at) return 1;
      
      // Swedish sources get priority
      const swedishSources = ['HRnytt.se', 'Chef.se', 'Arbetsvärlden', 'DN Ekonomi', 'SVT Nyheter', 'Sveriges Radio Ekonomi', 'Aftonbladet Ekonomi', 'Expressen Ekonomi', 'SvD Näringsliv', 'Dagens Industri'];
      const aIsSwedish = swedishSources.includes(a.source);
      const bIsSwedish = swedishSources.includes(b.source);
      if (aIsSwedish && !bIsSwedish) return -1;
      if (!aIsSwedish && bIsSwedish) return 1;
      
      return 0;
    });
    
    // Try to translate English articles to Swedish (limit to avoid rate limits)
    const translatedNews: NewsItem[] = [];
    let translationCount = 0;
    const maxTranslations = 5; // Limit translations per run
    
    for (const item of allNews) {
      if (isEnglish(item.title) && translationCount < maxTranslations) {
        // For now, just mark as English (translation can be added later)
        translatedNews.push({
          ...item,
          is_translated: false, // Would be true if we actually translated
        });
        translationCount++;
      } else {
        translatedNews.push(item);
      }
    }
    
    // Take top 20 most recent/relevant articles
    const topNews = translatedNews.slice(0, 20);
    
    if (topNews.length === 0) {
      console.log('No fresh HR news found');
      return new Response(JSON.stringify({ message: 'No fresh news', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Clear old news and insert new (only if we have new articles)
    const today = new Date().toISOString().split('T')[0];
    
    // Delete news older than 5 days
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await supabase.from('daily_hr_news').delete().lt('news_date', fiveDaysAgo);
    
    // Get existing article URLs to avoid duplicates
    const { data: existingArticles } = await supabase
      .from('daily_hr_news')
      .select('source_url')
      .not('source_url', 'is', null);
    
    const existingUrls = new Set((existingArticles || []).map(a => a.source_url));
    
    // Filter out articles we already have
    const newArticles = topNews.filter(item => !item.source_url || !existingUrls.has(item.source_url));
    
    if (newArticles.length === 0) {
      console.log('No new articles to insert');
      return new Response(JSON.stringify({ message: 'All articles already exist', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Insert new articles with category styling
    const newsToInsert = newArticles.map((item, index) => {
      const catInfo = getCategoryInfo(item.category);
      return {
        title: item.title,
        summary: item.summary,
        source: item.source,
        source_url: item.source_url,
        category: catInfo.label,
        icon_name: catInfo.icon,
        gradient: catInfo.gradient,
        news_date: today,
        order_index: index,
        is_translated: item.is_translated || false,
        published_at: item.published_at,
      };
    });
    
    const { error: insertError } = await supabase
      .from('daily_hr_news')
      .insert(newsToInsert);
    
    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }
    
    console.log(`Successfully inserted ${newsToInsert.length} HR news articles`);
    
    // Log distribution for debugging
    const sourceCounts: Record<string, number> = {};
    const catCounts: Record<string, number> = {};
    for (const item of newsToInsert) {
      sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
      catCounts[item.category] = (catCounts[item.category] || 0) + 1;
    }
    console.log('Source distribution:', sourceCounts);
    console.log('Category distribution:', catCounts);
    
    return new Response(JSON.stringify({ 
      message: 'HR news fetched successfully', 
      count: newsToInsert.length,
      sources: Object.keys(sourceCounts),
      categories: Object.keys(catCounts),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in fetch-hr-news:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
