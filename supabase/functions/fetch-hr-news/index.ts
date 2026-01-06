// HR News Fetcher - RSS first, AI fallback
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Swedish HR RSS feeds
const RSS_FEEDS = [
  { url: 'https://hrnytt.se/feed/', source: 'HR Nytt' },
];

interface RssItem {
  title: string;
  summary: string;
  source: string;
  source_url: string | null;
  category: string;
}

// Simple XML text extraction
function extractBetweenTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

// Parse RSS feed using regex (more reliable in Deno)
async function parseRssFeed(feedUrl: string, source: string): Promise<RssItem[]> {
  try {
    console.log(`Fetching RSS from: ${feedUrl}`);
    const response = await fetch(feedUrl, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; Parium-HR-News/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
    });
    
    if (!response.ok) {
      console.log(`RSS feed ${feedUrl} returned ${response.status}`);
      return [];
    }
    
    const xml = await response.text();
    console.log(`Received ${xml.length} bytes from ${feedUrl}`);
    
    // Extract items using regex
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const items: RssItem[] = [];
    let itemMatch;
    
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const itemXml = itemMatch[1];
      
      // Extract title
      const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      
      // Extract link
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
      const link = linkMatch ? linkMatch[1].trim() : '';
      
      // Extract description
      const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      let description = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      
      // Clean HTML from description
      description = description
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, '')
        .trim();
      
      if (!title) continue;
      
      // Categorize based on content
      const lowerTitle = title.toLowerCase();
      let category = 'trends';
      if (lowerTitle.includes('tech') || lowerTitle.includes('ai') || lowerTitle.includes('digital') || lowerTitle.includes('verktyg')) {
        category = 'hr_tech';
      } else if (lowerTitle.includes('ledar') || lowerTitle.includes('chef') || lowerTitle.includes('team') || lowerTitle.includes('medarbetar')) {
        category = 'leadership';
      } else if (lowerTitle.includes('global') || lowerTitle.includes('internationell') || lowerTitle.includes('europa') || lowerTitle.includes('usa')) {
        category = 'international';
      }
      
      items.push({
        title: title.slice(0, 100),
        summary: (description || title).slice(0, 150),
        source,
        source_url: link || null,
        category,
      });
      
      // Only get first 10 items max
      if (items.length >= 10) break;
    }
    
    console.log(`Parsed ${items.length} items from ${feedUrl}`);
    return items;
  } catch (error) {
    console.error(`Error fetching RSS from ${feedUrl}:`, error);
    return [];
  }
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
- Fokusera på: Innovation, nya verktyg, positiva trender, framgångsrika metoder

Svara ENDAST med valid JSON i detta format:
{
  "news": [
    {"title": "Kort rubrik max 50 tecken", "summary": "En mening max 80 tecken", "category": "hr_tech"},
    {"title": "...", "summary": "...", "category": "trends"},
    {"title": "...", "summary": "...", "category": "leadership"},
    {"title": "...", "summary": "...", "category": "international"}
  ]
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Du är en HR-nyhetsexpert. Svara endast med JSON." },
        { role: "user", content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in AI response");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }
  
  const newsData = JSON.parse(jsonMatch[0]);
  
  return (newsData.news || []).map((item: any) => ({
    title: item.title?.slice(0, 100) || 'HR-nyhet',
    summary: item.summary?.slice(0, 150) || '',
    source: 'HR Insight',
    source_url: null,
    category: item.category || 'trends',
  }));
}

// Select best 4 news items (one from each category if possible)
function selectBestNews(items: RssItem[]): RssItem[] {
  const selected: RssItem[] = [];
  const categories = ['hr_tech', 'trends', 'leadership', 'international'];
  
  // First pass: get one from each category
  for (const category of categories) {
    const item = items.find(i => i.category === category && !selected.includes(i));
    if (item) {
      selected.push(item);
    }
  }
  
  // Second pass: fill remaining slots
  for (const item of items) {
    if (selected.length >= 4) break;
    if (!selected.includes(item)) {
      // Assign missing category
      const usedCategories = selected.map(s => s.category);
      const missingCat = categories.find(c => !usedCategories.includes(c));
      if (missingCat) {
        item.category = missingCat;
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

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('force') === 'true';
    const today = new Date().toISOString().split('T')[0];
    
    // Check for existing news (unless force refresh)
    if (!forceRefresh) {
      const { data: existingNews } = await supabase
        .from('daily_hr_news')
        .select('*')
        .eq('news_date', today)
        .order('order_index');

      if (existingNews && existingNews.length >= 4) {
        console.log('Returning cached news for today');
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
      for (const feed of RSS_FEEDS) {
        const items = await parseRssFeed(feed.url, feed.source);
        newsItems.push(...items);
      }
      
      if (newsItems.length >= 4) {
        newsItems = selectBestNews(newsItems);
        console.log(`Got ${newsItems.length} items from RSS`);
      } else {
        console.log(`Only ${newsItems.length} RSS items, will try AI fallback`);
      }
    } catch (rssError) {
      console.error('RSS fetch failed:', rssError);
    }

    // Fallback to AI if RSS didn't provide enough
    if (newsItems.length < 4) {
      try {
        console.log('Using AI fallback...');
        const aiItems = await generateAiNews(today);
        const combined = [...newsItems, ...aiItems];
        newsItems = selectBestNews(combined);
        newsSource = newsItems.some(i => i.source_url) ? 'hybrid' : 'ai';
      } catch (aiError) {
        console.error('AI fallback failed:', aiError);
        if (newsItems.length === 0) {
          throw new Error('Both RSS and AI failed');
        }
      }
    }

    // Ensure we have exactly 4 items
    while (newsItems.length < 4) {
      const idx = newsItems.length;
      newsItems.push({
        title: `HR-trend ${idx + 1}`,
        summary: 'Senaste trenderna inom rekrytering.',
        source: 'HR Insight',
        source_url: null,
        category: CATEGORIES[idx % 4].key,
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

    console.log(`Saved ${insertedNews?.length} news items (source: ${newsSource})`);

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
