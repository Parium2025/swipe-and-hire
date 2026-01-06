// HR News Fetcher - Multi-source RSS with AI enhancement (FREE, no external API keys needed)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RSS sources - focused on HR, recruitment, leadership and labor market
// TRUSTED_SOURCES get automatic pass without strict keyword filtering
const TRUSTED_HR_SOURCES = [
  'HRnytt.se', 'Chef.se', 'Kollega', 'Motivation.se', 'Arbetsvärlden', 
  'Ledarna', 'Unionen', 'TCO', 'Almega', 'Svenskt Näringsliv',
  'HR Dive', 'SHRM', 'People Management', 'Teamtailor', 'LinkedIn Talent'
];

const RSS_SOURCES = [
  // === SWEDISH HR & RECRUITMENT (PRIMARY) ===
  { url: 'https://hrnytt.se/feed/', name: 'HRnytt.se' },
  { url: 'https://www.chef.se/feed/', name: 'Chef.se' },
  { url: 'https://kollega.se/feed/', name: 'Kollega' },
  { url: 'https://www.motivation.se/feed/', name: 'Motivation.se' },
  { url: 'https://arbetsvarlden.se/feed/', name: 'Arbetsvärlden' },
  
  // === SWEDISH UNIONS & ORGANIZATIONS ===
  { url: 'https://www.ledarna.se/rss/', name: 'Ledarna' },
  { url: 'https://www.unionen.se/rss.xml', name: 'Unionen' },
  { url: 'https://www.tco.se/feed/', name: 'TCO' },
  { url: 'https://www.almega.se/feed/', name: 'Almega' },
  { url: 'https://www.svensktnaringsliv.se/rss/', name: 'Svenskt Näringsliv' },
  
  // === INTERNATIONAL HR (English - for AI/trends/strategy) ===
  { url: 'https://www.hrdive.com/feeds/news/', name: 'HR Dive' },
  { url: 'https://www.shrm.org/rss/pages/rss.aspx', name: 'SHRM' },
  { url: 'https://www.peoplemanagement.co.uk/feed', name: 'People Management' },
  { url: 'https://www.ere.net/feed/', name: 'ERE Recruiting' },
  { url: 'https://recruitingdaily.com/feed/', name: 'Recruiting Daily' },
  
  // === HR TECH & AI ===
  { url: 'https://blog.teamtailor.com/rss.xml', name: 'Teamtailor' },
  { url: 'https://www.aihr.com/feed/', name: 'AIHR' },
  { url: 'https://www.tlnt.com/feed/', name: 'TLNT Talent' },
  
  // === SWEDISH BUSINESS (labor market angles) ===
  { url: 'https://www.va.se/rss/', name: 'Veckans Affärer' },
  { url: 'https://www.breakit.se/feed/articles', name: 'Breakit' },
];

// Keywords to filter out truly negative/scandal content (not labor market statistics)
const NEGATIVE_KEYWORDS = [
  'skandal', 'misslyck', 'strejk', 'konflikt', 'döm', 
  'åtal', 'brott', 'svek', 'fusk', 'bedrägeri', 'diskriminer',
  'mobbing', 'trakasser', 'hot', 'våld'
];

// Keywords that indicate HR-relevant content (at least 2 must match)
const HR_RELEVANCE_KEYWORDS = [
  // Core HR terms
  'hr', 'rekryter', 'anställ', 'personal', 'medarbetar', 'arbetsplats', 'arbetsmiljö',
  'arbetsgivare', 'arbetstagare', 'arbetsmarknad', 'arbetsrätt', 'arbetsliv',
  // Leadership & Management
  'chef', 'ledar', 'ledning', 'team', 'organisation', 'företagskultur',
  // Talent & Competence
  'talent', 'kompetens', 'utbildning', 'utveckling', 'karriär', 'lön', 'förmån',
  // Hiring process
  'kandidat', 'intervju', 'urval', 'onboarding', 'offboarding', 'cv', 'jobbansök',
  // Modern workplace
  'hybridarbete', 'distansarbete', 'hemarbete', 'flexibel', 'work-life',
  // HR Tech
  'hr-tech', 'hrtech', 'ats', 'hris', 'lms',
  // Wellbeing
  'trivsel', 'engagemang', 'motivation', 'välmående',
  // Employment types
  'heltid', 'deltid', 'konsult', 'vikarie', 'provanställ',
  // Labor market & employment
  'arbetslöshet', 'arbetslös', 'sysselsättning', 'jobbmarknad', 'varsel',
  'kollektivavtal', 'fackförening', 'fack', 'unionen', 'tjänstemän'
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
    keywords: ['trend', 'framtid', '2026', '2025', 'förändring', 'utveckling', 'arbetsmarknad', 'statistik', 'ökning', 'tillväxt']
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
    keywords: ['rekryter', 'kandidat', 'anställ', 'intervju', 'urval', 'onboarding', 'talent', 'kompetens', 'lön', 'karriär', 'jobb']
  },
];

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  source_url: string | null;
  category: string;
  published_at: string | null;
}

// Check if a date is within the last 48 hours (allows more source diversity)
function isWithin48Hours(dateStr: string): boolean {
  try {
    const pubDate = new Date(dateStr);
    if (isNaN(pubDate.getTime())) return false;
    
    const now = new Date();
    const hoursDiff = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 48;
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
    
    // Extract pubDate
    const pubDateMatch = itemContent.match(/<pubDate>([^<]*)<\/pubDate>/i) ||
                         itemContent.match(/<dc:date>([^<]*)<\/dc:date>/i) ||
                         itemContent.match(/<published>([^<]*)<\/published>/i);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : null;
    
    // Skip articles older than 48 hours
    if (pubDate && !isWithin48Hours(pubDate)) {
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
      
      newsItems.push({
        title: item.title.slice(0, 100),
        summary: item.description.slice(0, 150) || `Läs mer på ${source.name}`,
        source: source.name,
        source_url: item.link || null,
        category,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
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

// Use Lovable AI (FREE) to enhance summaries
async function enhanceWithAI(items: NewsItem[]): Promise<NewsItem[]> {
  if (items.length === 0) return [];
  
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY, returning items as-is');
    return items;
  }

  try {
    console.log('Enhancing news with AI...');
    
    const prompt = `Du är en HR-expert. Här är ${items.length} nyhetsartiklar från HRnytt.se.

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
        published_at: item.published_at,
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
