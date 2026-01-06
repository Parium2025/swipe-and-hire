import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Categories with their styling
const CATEGORIES = [
  { 
    key: 'hr_tech', 
    label: 'HR-Tech',
    icon: 'Cpu',
    gradient: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90'
  },
  { 
    key: 'trends', 
    label: 'Trender',
    icon: 'TrendingUp',
    gradient: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90'
  },
  { 
    key: 'leadership', 
    label: 'Ledarskap',
    icon: 'Users',
    gradient: 'from-violet-500/90 via-purple-600/80 to-purple-700/90'
  },
  { 
    key: 'international', 
    label: 'Internationellt',
    icon: 'Globe',
    gradient: 'from-amber-500/90 via-orange-500/80 to-orange-600/90'
  },
];

// Swedish HR RSS feeds to try
const RSS_FEEDS = [
  { url: 'https://www.hrnytt.se/feed/', source: 'HR Nytt', category: 'trends' },
  { url: 'https://www.personalledarskap.se/feed/', source: 'Personal & Ledarskap', category: 'leadership' },
  { url: 'https://www.breakit.se/feed', source: 'Breakit', category: 'hr_tech' },
  { url: 'https://arbetsmarknadsnytt.se/feed/', source: 'Arbetsmarknadsnytt', category: 'trends' },
  { url: 'https://www.prevent.se/rss', source: 'Prevent', category: 'leadership' },
];

interface RssItem {
  title: string;
  summary: string;
  source: string;
  source_url: string;
  category: string;
  pubDate?: Date;
}

// Parse RSS feed and extract items
async function parseRssFeed(feedUrl: string, source: string, defaultCategory: string): Promise<RssItem[]> {
  try {
    console.log(`Fetching RSS from: ${feedUrl}`);
    const response = await fetch(feedUrl, { 
      headers: { 'User-Agent': 'Parium-HR-News-Bot/1.0' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) {
      console.log(`RSS feed ${feedUrl} returned ${response.status}`);
      return [];
    }
    
    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    
    if (!doc) {
      console.log(`Failed to parse XML from ${feedUrl}`);
      return [];
    }
    
    const items: RssItem[] = [];
    const itemElements = doc.querySelectorAll("item");
    
    for (const item of itemElements) {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const description = item.querySelector("description")?.textContent?.trim() || "";
      const link = item.querySelector("link")?.textContent?.trim() || "";
      const pubDateStr = item.querySelector("pubDate")?.textContent?.trim();
      
      // Skip if no title or it's too old
      if (!title) continue;
      
      // Parse publication date
      let pubDate: Date | undefined;
      if (pubDateStr) {
        pubDate = new Date(pubDateStr);
      }
      
      // Clean up description (remove HTML tags)
      const cleanDescription = description
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim()
        .slice(0, 150);
      
      // Determine category based on content
      let category = defaultCategory;
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('tech') || lowerTitle.includes('ai') || lowerTitle.includes('digital')) {
        category = 'hr_tech';
      } else if (lowerTitle.includes('ledar') || lowerTitle.includes('chef') || lowerTitle.includes('team')) {
        category = 'leadership';
      } else if (lowerTitle.includes('global') || lowerTitle.includes('internationell') || lowerTitle.includes('europa')) {
        category = 'international';
      }
      
      items.push({
        title: title.slice(0, 100),
        summary: cleanDescription || title.slice(0, 80),
        source,
        source_url: link,
        category,
        pubDate,
      });
    }
    
    console.log(`Parsed ${items.length} items from ${feedUrl}`);
    return items;
  } catch (error) {
    console.error(`Error fetching RSS from ${feedUrl}:`, error.message);
    return [];
  }
}

// Fetch news from all RSS feeds
async function fetchRssNews(): Promise<RssItem[]> {
  const allItems: RssItem[] = [];
  
  // Fetch all feeds in parallel
  const results = await Promise.all(
    RSS_FEEDS.map(feed => parseRssFeed(feed.url, feed.source, feed.category))
  );
  
  for (const items of results) {
    allItems.push(...items);
  }
  
  // Filter to only include items from last 48 hours
  const twoDaysAgo = new Date();
  twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
  
  const recentItems = allItems.filter(item => {
    if (!item.pubDate) return true; // Include items without date
    return item.pubDate >= twoDaysAgo;
  });
  
  // Sort by date (newest first)
  recentItems.sort((a, b) => {
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    return b.pubDate.getTime() - a.pubDate.getTime();
  });
  
  console.log(`Total RSS items: ${allItems.length}, Recent items: ${recentItems.length}`);
  return recentItems;
}

// Generate AI fallback news
async function generateAiNews(today: string): Promise<RssItem[]> {
  console.log('Generating AI fallback news...');
  
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  
  const prompt = `Du är en HR-nyhetsexpert. Generera 4 korta, positiva och inspirerande nyheter/trender inom rekrytering och HR för idag (${today}).

VIKTIGT:
- Undvik: Debattartiklar, konkurser, varsel, kriser, negativa nyheter
- Fokusera på: Innovation, nya verktyg, positiva trender, framgångsrika metoder, internationella insikter
- Källor att inspireras av: HR-Nytt, Personnel & Ledarskap, HR Dive, SHRM, Recruiting Daily, LinkedIn-trender

Svara ENDAST med valid JSON i detta format (inget annat):
{
  "news": [
    {
      "title": "Kort rubrik (max 50 tecken)",
      "summary": "En mening sammanfattning (max 80 tecken)",
      "source": "HR Insight",
      "category": "hr_tech"
    },
    {
      "title": "...",
      "summary": "...",
      "source": "HR Insight",
      "category": "trends"
    },
    {
      "title": "...",
      "summary": "...",
      "source": "HR Insight",
      "category": "leadership"
    },
    {
      "title": "...",
      "summary": "...",
      "source": "HR Insight",
      "category": "international"
    }
  ]
}

Kategorier: hr_tech, trends, leadership, international`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Du är en HR-nyhetsexpert som genererar korta, positiva nyheter på svenska." },
        { role: "user", content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in AI response");
  }

  // Parse JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }
  
  const newsData = JSON.parse(jsonMatch[0]);
  
  if (!newsData.news || !Array.isArray(newsData.news)) {
    throw new Error("Invalid news format");
  }

  return newsData.news.map((item: any) => ({
    title: item.title?.slice(0, 100) || 'HR-nyhet',
    summary: item.summary?.slice(0, 150) || '',
    source: item.source || 'HR Insight',
    source_url: null,
    category: item.category || 'trends',
  }));
}

// Select best 4 news items (one from each category if possible)
function selectBestNews(items: RssItem[]): RssItem[] {
  const selected: RssItem[] = [];
  const usedCategories = new Set<string>();
  
  // First pass: get one from each category
  for (const category of ['hr_tech', 'trends', 'leadership', 'international']) {
    const item = items.find(i => i.category === category && !selected.includes(i));
    if (item) {
      selected.push(item);
      usedCategories.add(category);
    }
  }
  
  // Second pass: fill remaining slots with any items
  for (const item of items) {
    if (selected.length >= 4) break;
    if (!selected.includes(item)) {
      // Assign a category if we need more variety
      const missingCategories = ['hr_tech', 'trends', 'leadership', 'international'].filter(c => !usedCategories.has(c));
      if (missingCategories.length > 0) {
        item.category = missingCategories[0];
        usedCategories.add(missingCategories[0]);
      }
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

    // Check if this is a force refresh request
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('force') === 'true';

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Check for existing news (unless force refresh)
    if (!forceRefresh) {
      const { data: existingNews } = await supabase
        .from('daily_hr_news')
        .select('*')
        .eq('news_date', today)
        .order('order_index');

      if (existingNews && existingNews.length >= 4) {
        console.log('News already exists for today, returning cached news');
        return new Response(JSON.stringify({ news: existingNews, cached: true, source: 'cache' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log('Fetching fresh HR news...');
    
    let newsItems: RssItem[] = [];
    let newsSource = 'rss';

    // Try RSS first
    try {
      const rssItems = await fetchRssNews();
      if (rssItems.length >= 4) {
        newsItems = selectBestNews(rssItems);
        console.log(`Using ${newsItems.length} RSS items`);
      } else {
        console.log(`Only ${rssItems.length} RSS items found, falling back to AI`);
      }
    } catch (rssError) {
      console.error('RSS fetch failed:', rssError.message);
    }

    // Fallback to AI if RSS didn't provide enough items
    if (newsItems.length < 4) {
      try {
        const aiItems = await generateAiNews(today);
        // Merge with any RSS items we got
        const combined = [...newsItems, ...aiItems];
        newsItems = selectBestNews(combined);
        newsSource = newsItems.some(i => i.source_url) ? 'hybrid' : 'ai';
        console.log(`Using ${newsItems.length} items (source: ${newsSource})`);
      } catch (aiError) {
        console.error('AI fallback failed:', aiError.message);
        
        // If both failed, return error
        if (newsItems.length === 0) {
          throw new Error('Both RSS and AI fallback failed');
        }
      }
    }

    // Ensure we have exactly 4 items
    while (newsItems.length < 4) {
      const categoryIndex = newsItems.length;
      const category = CATEGORIES[categoryIndex % 4];
      newsItems.push({
        title: `HR-trend ${categoryIndex + 1}`,
        summary: 'Läs mer om de senaste trenderna inom rekrytering.',
        source: 'HR Insight',
        source_url: '',
        category: category.key,
      });
    }

    // Delete old news for today and insert new
    await supabase
      .from('daily_hr_news')
      .delete()
      .eq('news_date', today);

    // Insert new news with category styling
    const newsToInsert = newsItems.slice(0, 4).map((item, index) => {
      const categoryConfig = CATEGORIES.find(c => c.key === item.category) || CATEGORIES[index % 4];
      return {
        title: item.title,
        summary: item.summary,
        source: item.source,
        source_url: item.source_url || null,
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

    console.log(`Successfully saved ${insertedNews?.length} news items (source: ${newsSource})`);

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
