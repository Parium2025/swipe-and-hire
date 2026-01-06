// HR News Fetcher - Multi-source RSS with AI enhancement (FREE, no external API keys needed)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RSS sources for recruitment, HR and job market news (15+ sources for variety)
const RSS_SOURCES = [
  // HR & Recruitment
  { url: 'https://hrnytt.se/feed', name: 'HRnytt.se' },
  { url: 'https://www.chef.se/feed/', name: 'Chef.se' },
  { url: 'https://www.kollega.se/rss.xml', name: 'Kollega' },
  { url: 'https://arbetsmarknadsnytt.se/feed/', name: 'Arbetsmarknadsnytt' },
  { url: 'https://www.motivation.se/feed/', name: 'Motivation.se' },
  { url: 'https://www.arbetsvarlden.se/feed/', name: 'Arbetsvärlden' },
  // Business & Career
  { url: 'https://www.breakit.se/feed', name: 'Breakit' },
  { url: 'https://www.va.se/rss/nyheter', name: 'Veckans Affärer' },
  { url: 'https://www.resumé.se/feed/', name: 'Resumé' },
  { url: 'https://www.dagensmedia.se/feed/', name: 'Dagens Media' },
  // Tech & Innovation
  { url: 'https://computersweden.se/feed/', name: 'Computer Sweden' },
  { url: 'https://www.idg.se/rss/nyheter', name: 'IDG' },
  { url: 'https://www.nyteknik.se/feed/', name: 'Ny Teknik' },
  // General business news
  { url: 'https://www.di.se/rss', name: 'Dagens Industri' },
  { url: 'https://www.svd.se/feed/naringsliv.rss', name: 'SvD Näringsliv' },
];

// Keywords that indicate negative content to filter out
const NEGATIVE_KEYWORDS = [
  'uppsägning', 'avsked', 'varsel', 'konkurs', 'nedskärning', 'kris', 
  'skandal', 'misslyck', 'problem', 'strejk', 'konflikt', 'döm', 
  'åtal', 'brott', 'svek', 'fusk', 'bedrägeri', 'diskriminer',
  'utbrändhet', 'sjukskriv', 'mobbing', 'trakasser', 'hot', 'våld'
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
}

// Parse RSS XML to extract news items
function parseRSSItems(xml: string): { title: string; description: string; link: string }[] {
  const items: { title: string; description: string; link: string }[] = [];
  
  // Extract <item> blocks
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  
  for (const match of itemMatches) {
    const itemContent = match[1];
    
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
      items.push({ title, description, link });
    }
  }
  
  return items;
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
    
    for (const item of rssItems.slice(0, 5)) {
      const fullText = `${item.title} ${item.description}`;
      
      // Skip negative content
      if (isNegativeContent(fullText)) {
        console.log(`Skipping negative: ${item.title.slice(0, 50)}...`);
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
function selectBestNews(items: NewsItem[]): NewsItem[] {
  const selected: NewsItem[] = [];
  const categoryKeys = CATEGORIES.map(c => c.key);
  const usedSources = new Set<string>();
  
  // First pass: get one from each category with diverse sources
  for (const category of categoryKeys) {
    const item = items.find(i => 
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
    
    const item = items.find(i => i.category === category && !selected.includes(i));
    if (item) {
      selected.push(item);
    }
  }
  
  // Third pass: fill with any remaining items
  for (const item of items) {
    if (selected.length >= 4) break;
    if (!selected.includes(item)) {
      selected.push(item);
    }
  }
  
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
     
     // Check for existing REAL news (unless force refresh)
     if (!forceRefresh) {
       const { data: existingNews } = await supabase
         .from('daily_hr_news')
         .select('*')
         .eq('news_date', today)
         .order('order_index');

       const hasRealSources = existingNews?.some((n) => n.source_url);
       if (existingNews && existingNews.length > 0 && hasRealSources) {
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
