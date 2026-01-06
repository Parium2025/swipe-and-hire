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
  'HRnytt.se', 'Chef.se', 'Kollega', 'Arbetsvärlden',
  // International HR (verified working)
  'HR Dive', 'HR Executive', 'AIHR', 'People Management', 'Personnel Today',
  // Business/Career (verified working)
  'Fast Company', 'Inc.', 'DN Ekonomi'
];

const RSS_SOURCES = [
  // === SWEDISH HR & RECRUITMENT (VERIFIED WORKING) ===
  { url: 'https://hrnytt.se/feed/', name: 'HRnytt.se' },
  { url: 'https://www.chef.se/feed/', name: 'Chef.se' },
  { url: 'https://arbetsvarlden.se/feed/', name: 'Arbetsvärlden' },
  
  // === SWEDISH NEWS (VERIFIED WORKING) ===
  { url: 'https://www.dn.se/rss/ekonomi/', name: 'DN Ekonomi' },
  
  // === INTERNATIONAL HR (VERIFIED WORKING) ===
  { url: 'https://www.hrdive.com/feeds/news/', name: 'HR Dive' },
  { url: 'https://hrexecutive.com/feed/', name: 'HR Executive' },
  { url: 'https://www.aihr.com/feed/', name: 'AIHR' },
  { url: 'https://www.peoplemanagement.co.uk/feed', name: 'People Management' },
  { url: 'https://www.personneltoday.com/feed/', name: 'Personnel Today' },
  
  // === CAREER & BUSINESS (VERIFIED WORKING - high volume) ===
  { url: 'https://www.fastcompany.com/rss', name: 'Fast Company' },
  { url: 'https://www.inc.com/rss', name: 'Inc.' },
];

// Keywords to filter out truly negative/scandal content (not labor market statistics)
const NEGATIVE_KEYWORDS = [
  'skandal', 'misslyck', 'strejk', 'konflikt', 'döm', 
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
      
      // Get publication date - try RSS first, then cache/scrape
      let publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : null;
      
      if (!publishedAt && item.link) {
        publishedAt = await getCachedOrScrapedDate(item.link, source.name);
      }
      
      // CRITICAL: Apply 5-day filter to ALL articles, including scraped dates
      // Skip if we have a date and it's older than 5 days
      if (publishedAt && !isWithin5Days(publishedAt)) {
        console.log(`Skipping old article (${publishedAt}): ${item.title.slice(0, 40)}...`);
        continue;
      }
      
      // Skip articles without any date - we can't verify freshness
      if (!publishedAt) {
        console.log(`Skipping article without date: ${item.title.slice(0, 40)}...`);
        continue;
      }
      
      newsItems.push({
        title: item.title.slice(0, 100),
        summary: item.description.slice(0, 150) || `Läs mer på ${source.name}`,
        source: source.name,
        source_url: item.link || null,
        category,
        published_at: publishedAt,
      });
    }
    
    return newsItems;
  } catch (error) {
    console.error(`Error fetching ${source.name}:`, error);
    return [];
  }
}

// Fetch news from all RSS sources
async function fetchAllRSSSources(): Promise<NewsItem[]> {
  console.log('Fetching from all RSS sources...');
  
  const results = await Promise.allSettled(
    RSS_SOURCES.map(source => fetchRSSSource(source))
  );
  
  const allItems: NewsItem[] = [];
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allItems.push(...result.value);
    }
  }
  
  console.log(`Total items from all sources: ${allItems.length}`);
  return allItems;
}

// English sources that need translation
const ENGLISH_SOURCES = [
  'HR Dive', 'SHRM', 'People Management', 'ERE Recruiting', 
  'Recruiting Daily', 'Teamtailor', 'AIHR', 'TLNT Talent', 'LinkedIn Talent'
];

// Detect if text is likely English
function isEnglishText(text: string): boolean {
  const englishWords = ['the', 'and', 'for', 'are', 'that', 'with', 'your', 'how', 'can', 'will'];
  const lowerText = text.toLowerCase();
  const matchCount = englishWords.filter(word => lowerText.includes(` ${word} `)).length;
  return matchCount >= 2;
}

// Translate English articles to Swedish using Lovable AI
async function translateToSwedish(items: NewsItem[]): Promise<NewsItem[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return items;

  // Find items that need translation (mark them first)
  const translationIndices: number[] = [];
  items.forEach((item, i) => {
    if (ENGLISH_SOURCES.includes(item.source) || isEnglishText(`${item.title} ${item.summary}`)) {
      translationIndices.push(i);
    }
  });

  if (translationIndices.length === 0) {
    console.log('No English articles to translate');
    return items;
  }

  const itemsToTranslate = translationIndices.map(i => items[i]);
  console.log(`Translating ${itemsToTranslate.length} English articles to Swedish...`);

  try {
    const prompt = `Översätt följande nyhetsrubriker och sammanfattningar från engelska till svenska.
Behåll professionell HR-terminologi. Gör texterna naturliga på svenska.

Artiklar att översätta:
${itemsToTranslate.map((item, i) => `${i + 1}. Titel: "${item.title}"
   Sammanfattning: "${item.summary}"`).join('\n\n')}

Svara ENDAST med valid JSON:
{"translations": [{"title": "svensk titel", "summary": "svensk sammanfattning"}, ...]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.log('Translation failed, using original text');
      // Still mark as translated (from English source)
      translationIndices.forEach(i => { items[i].is_translated = true; });
      return items;
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      const translations = data.translations || [];
      
      // Apply translations and mark as translated
      translationIndices.forEach((originalIndex, i) => {
        items[originalIndex].is_translated = true; // Always mark English sources
        if (translations[i]) {
          if (translations[i].title && translations[i].title.length > 5) {
            items[originalIndex].title = translations[i].title.slice(0, 100);
          }
          if (translations[i].summary && translations[i].summary.length > 5) {
            items[originalIndex].summary = translations[i].summary.slice(0, 150);
          }
        }
      });
      console.log(`Successfully translated ${translations.length} articles`);
    } else {
      // Mark as translated even if parsing failed
      translationIndices.forEach(i => { items[i].is_translated = true; });
    }
    
    return items;
  } catch (error) {
    console.error('Translation error:', error);
    // Still mark English sources
    translationIndices.forEach(i => { items[i].is_translated = true; });
    return items;
  }
}

// Use Lovable AI (FREE) to enhance summaries
async function enhanceWithAI(items: NewsItem[]): Promise<NewsItem[]> {
  if (items.length === 0) return [];
  
  // First translate any English articles
  items = await translateToSwedish(items);
  
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY, returning items as-is');
    return items;
  }

  try {
    console.log('Enhancing news with AI...');
    
    const prompt = `Du är en HR-expert. Här är ${items.length} nyhetsartiklar.

För varje artikel, skriv en kort och engagerande sammanfattning på svenska (max 70 tecken).
Gör sammanfattningen informativ och professionell.

Artiklar:
${items.map((item, i) => `${i + 1}. Rubrik: "${item.title}"
   Original: "${item.summary}"`).join('\n\n')}

Svara ENDAST med valid JSON, inget annat:
{"summaries": ["sammanfattning 1", "sammanfattning 2", ...]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      console.log('AI enhancement failed, using original summaries');
      return items;
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      const summaries = data.summaries || [];
      
      items.forEach((item, i) => {
        if (summaries[i] && summaries[i].length > 10) {
          item.summary = summaries[i].slice(0, 100);
        }
      });
      console.log('AI enhancement successful');
    }
    
    return items;
  } catch (error) {
    console.error('AI enhancement error:', error);
    return items;
  }
}

// Select best 4 news items (one from each category if possible, diverse sources)
// Sort by published_at so newest articles come first
function selectBestNews(items: NewsItem[]): NewsItem[] {
  // First, sort all items by published_at (newest first)
  const sortedItems = [...items].sort((a, b) => {
    if (!a.published_at && !b.published_at) return 0;
    if (!a.published_at) return 1;
    if (!b.published_at) return -1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  const selected: NewsItem[] = [];
  const categoryKeys = CATEGORIES.map(c => c.key);
  const usedSources = new Set<string>();
  
  // First pass: get one from each category with diverse sources (prefer newer items)
  for (const category of categoryKeys) {
    const item = sortedItems.find(i => 
      i.category === category && 
      !selected.includes(i) && 
      !usedSources.has(i.source)
    );
    if (item) {
      selected.push(item);
      usedSources.add(item.source);
    }
  }
  
  // Second pass: fill remaining slots (allow same source if needed)
  for (const category of categoryKeys) {
    if (selected.length >= 4) break;
    if (selected.some(s => s.category === category)) continue;
    
    const item = sortedItems.find(i => i.category === category && !selected.includes(i));
    if (item) {
      selected.push(item);
    }
  }
  
  // Third pass: fill with any remaining items (newest first)
  for (const item of sortedItems) {
    if (selected.length >= 4) break;
    if (!selected.includes(item)) {
      selected.push(item);
    }
  }
  
  // Final sort: ensure newest article is always first position
  selected.sort((a, b) => {
    if (!a.published_at && !b.published_at) return 0;
    if (!a.published_at) return 1;
    if (!b.published_at) return -1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
  
  return selected;
}
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

     const url = new URL(req.url);

     let forceRefresh = url.searchParams.get('force') === 'true';
     try {
       const body = await req.json();
       if (typeof body?.force === 'boolean') {
         forceRefresh = body.force;
       }
     } catch {
       // Request had no JSON body
     }

     const today = new Date().toISOString().split('T')[0];
     const currentHour = new Date().getUTCHours();
     const isMiddayCheck = currentHour >= 10 && currentHour <= 12; // 11:00-13:00 UTC window
     
     // Check for existing news
     const { data: existingNews } = await supabase
       .from('daily_hr_news')
       .select('*')
       .eq('news_date', today)
       .order('order_index');

     const realArticleCount = existingNews?.filter((n) => n.source_url)?.length || 0;
     
     // At midday: only refresh if we have fewer than 4 real articles
     if (isMiddayCheck && !forceRefresh) {
       if (realArticleCount >= 4) {
         console.log(`Midday check: Already have ${realArticleCount} real articles, skipping`);
         return new Response(JSON.stringify({ news: existingNews, cached: true, source: 'cache', reason: 'midday_skip' }), {
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
       console.log(`Midday check: Only ${realArticleCount} real articles, fetching more...`);
     }
     
     // Morning or force: use cache if we have real sources
     if (!forceRefresh && !isMiddayCheck) {
       if (existingNews && existingNews.length > 0 && realArticleCount > 0) {
         console.log('Returning cached news for today (real sources)');
         return new Response(JSON.stringify({ news: existingNews, cached: true, source: 'cache' }), {
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
     }

    console.log('Fetching fresh HR news from multiple RSS sources...');
    
    // Load cached article dates before fetching (avoids scraping same articles)
    await loadExistingArticleDates(supabase);
    
    // Fetch from all RSS sources
    let newsItems = await fetchAllRSSSources();
    let newsSource = 'rss';

    if (newsItems.length >= 4) {
      // Select best diverse items first, then enhance with AI
      newsItems = selectBestNews(newsItems);
      newsItems = await enhanceWithAI(newsItems);
      console.log(`Selected ${newsItems.length} items from RSS`);
    } else {
      console.log(`Only got ${newsItems.length} RSS items, using what we have`);
      if (newsItems.length > 0) {
        newsItems = await enhanceWithAI(newsItems);
      }
    }

     if (newsItems.length === 0) {
       console.log('No RSS items found, not updating cache');
       return new Response(JSON.stringify({ news: [], cached: false, source: newsSource }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }

    // Delete old news for today and insert new
    await supabase.from('daily_hr_news').delete().eq('news_date', today);

    const newsToInsert = newsItems.slice(0, 4).map((item, index) => {
      const categoryConfig = CATEGORIES.find(c => c.key === item.category) || CATEGORIES[index % 4];
      // Keep original published_at - don't fake it with current time
      // Articles without dates will show no time in UI (better than wrong time)
      return {
        title: item.title,
        summary: item.summary,
        source: item.source,
        source_url: item.source_url,
        category: item.category || categoryConfig.key,
        icon_name: categoryConfig.icon,
        gradient: categoryConfig.gradient,
        news_date: today,
        order_index: index,
        published_at: item.published_at || null,
        is_translated: item.is_translated || false,
      };
    });

    const { data: insertedNews, error: insertError } = await supabase
      .from('daily_hr_news')
      .insert(newsToInsert)
      .select();

    if (insertError) {
      console.error("Failed to insert news:", insertError);
      throw new Error("Failed to save news");
    }

    console.log(`Successfully saved ${insertedNews?.length} news items from ${newsSource}`);

    return new Response(JSON.stringify({ news: insertedNews, cached: false, source: newsSource }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in fetch-hr-news:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
