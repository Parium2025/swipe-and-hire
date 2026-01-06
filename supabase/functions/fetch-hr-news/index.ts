// HR News Fetcher - RSS-based with AI enhancement (FREE, no external API keys needed)
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
    gradient: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90',
    keywords: ['ai', 'tech', 'digital', 'verktyg', 'automatiser', 'system', 'program', 'robot', 'chatbot', 'plattform']
  },
  { 
    key: 'trends', 
    label: 'Trender',
    icon: 'TrendingUp',
    gradient: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90',
    keywords: ['trend', 'framtid', '2026', '2025', 'förändring', 'utveckling', 'arbetsmarknad', 'statistik']
  },
  { 
    key: 'leadership', 
    label: 'Ledarskap',
    icon: 'Users',
    gradient: 'from-violet-500/90 via-purple-600/80 to-purple-700/90',
    keywords: ['ledar', 'chef', 'team', 'medarbetar', 'förebild', 'kultur', 'motivation', 'feedback', 'arbetsmiljö']
  },
  { 
    key: 'recruitment', 
    label: 'Rekrytering',
    icon: 'UserPlus',
    gradient: 'from-amber-500/90 via-orange-500/80 to-orange-600/90',
    keywords: ['rekryter', 'kandidat', 'anställ', 'intervju', 'urval', 'onboarding', 'talent', 'kompetens', 'lön']
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
    
    // Extract title
    const titleMatch = itemContent.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract description
    const descMatch = itemContent.match(/<description>([^<]*)<\/description>/i);
    const description = descMatch ? descMatch[1].trim() : '';
    
    // Extract link - handle both formats
    const linkMatch = itemContent.match(/<link>([^<]*)<\/link>/i) || 
                      itemContent.match(/<link[^>]*href="([^"]+)"/i) ||
                      itemContent.match(/<guid>([^<]*)<\/guid>/i);
    const link = linkMatch ? linkMatch[1].trim() : '';
    
    if (title && title.length > 10) {
      items.push({ title, description, link });
    }
  }
  
  return items;
}

// Fetch news from HRnytt RSS feed
async function fetchHRnyttRSS(): Promise<NewsItem[]> {
  try {
    console.log('Fetching HRnytt RSS feed...');
    
    const response = await fetch('https://hrnytt.se/feed', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Parium/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });
    
    if (!response.ok) {
      console.log(`HRnytt RSS returned ${response.status}`);
      return [];
    }
    
    const xml = await response.text();
    console.log(`RSS response length: ${xml.length}`);
    
    const rssItems = parseRSSItems(xml);
    console.log(`Parsed ${rssItems.length} items from RSS`);
    
    const newsItems: NewsItem[] = rssItems.slice(0, 10).map(item => {
      // Categorize based on title and description
      const searchText = `${item.title} ${item.description}`.toLowerCase();
      let category = 'trends';
      
      for (const cat of CATEGORIES) {
        if (cat.keywords.some(keyword => searchText.includes(keyword))) {
          category = cat.key;
          break;
        }
      }
      
      return {
        title: item.title.slice(0, 80),
        summary: item.description.slice(0, 120) || 'Läs mer på HRnytt.se',
        source: 'HRnytt.se',
        source_url: item.link || null,
        category,
      };
    });
    
    console.log(`Converted to ${newsItems.length} news items`);
    return newsItems;
  } catch (error) {
    console.error('Error fetching HRnytt RSS:', error);
    return [];
  }
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

// Select best 4 news items (one from each category if possible)
function selectBestNews(items: NewsItem[]): NewsItem[] {
  const selected: NewsItem[] = [];
  const categoryKeys = CATEGORIES.map(c => c.key);
  
  // First pass: get one from each category
  for (const category of categoryKeys) {
    const item = items.find(i => i.category === category && !selected.includes(i));
    if (item) {
      selected.push(item);
    }
  }
  
  // Second pass: fill remaining slots
  for (const item of items) {
    if (selected.length >= 4) break;
    if (!selected.includes(item)) {
      // Assign to a missing category
      const usedCategories = selected.map(s => s.category);
      const missingCat = categoryKeys.find(c => !usedCategories.includes(c));
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

    console.log('Fetching fresh HR news from RSS...');
    
    // Fetch from HRnytt RSS
    let newsItems = await fetchHRnyttRSS();
    let newsSource = 'rss';

    if (newsItems.length >= 4) {
      // Enhance with AI summaries (FREE via Lovable AI)
      newsItems = await enhanceWithAI(newsItems);
      newsItems = selectBestNews(newsItems);
      console.log(`Selected ${newsItems.length} items from RSS`);
    } else {
      console.log(`Only got ${newsItems.length} RSS items, using what we have`);
      // If we have some items but less than 4, still use them
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
