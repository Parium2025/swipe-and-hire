// HR News Fetcher - Web scraping first, AI fallback
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

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  source_url: string | null;
  category: string;
}

// Scrape HRnytt.se homepage
async function scrapeHRnytt(): Promise<NewsItem[]> {
  try {
    console.log('Scraping HRnytt.se...');
    const response = await fetch('https://hrnytt.se/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    
    if (!response.ok) {
      console.log(`HRnytt returned ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    const items: NewsItem[] = [];
    
    // Extract articles - look for links with article patterns
    // Pattern: [![Title](image)](url) followed by ## [Title](url) and description
    const articlePattern = /\[([^\]]{10,100})\]\((https:\/\/hrnytt\.se\/[^)]+)\)/g;
    const seen = new Set<string>();
    let match;
    
    while ((match = articlePattern.exec(html)) !== null) {
      const title = match[1].replace(/\*\*/g, '').trim();
      const url = match[2];
      
      // Skip images, ads, navigation
      if (url.includes('blob.core') || url.includes('annons') || seen.has(url)) continue;
      if (title.length < 15 || title.startsWith('!')) continue;
      
      seen.add(url);
      
      // Categorize
      const lowerTitle = title.toLowerCase();
      let category = 'trends';
      if (lowerTitle.includes('ai') || lowerTitle.includes('tech') || lowerTitle.includes('digital') || lowerTitle.includes('verktyg') || lowerTitle.includes('automatiser')) {
        category = 'hr_tech';
      } else if (lowerTitle.includes('ledar') || lowerTitle.includes('chef') || lowerTitle.includes('team') || lowerTitle.includes('medarbetar') || lowerTitle.includes('förebild')) {
        category = 'leadership';
      } else if (lowerTitle.includes('global') || lowerTitle.includes('internationell') || lowerTitle.includes('europa') || lowerTitle.includes('utland')) {
        category = 'international';
      }
      
      items.push({
        title: title.slice(0, 80),
        summary: `Läs mer på HRnytt.se`,
        source: 'HRnytt.se',
        source_url: url,
        category,
      });
      
      if (items.length >= 6) break;
    }
    
    console.log(`Scraped ${items.length} articles from HRnytt`);
    return items;
  } catch (error) {
    console.error('Error scraping HRnytt:', error);
    return [];
  }
}

// Scrape TNG blog
async function scrapeTNG(): Promise<NewsItem[]> {
  try {
    console.log('Scraping TNG.se...');
    const response = await fetch('https://www.tng.se/bloggen/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    
    if (!response.ok) {
      console.log(`TNG returned ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    const items: NewsItem[] = [];
    
    // Extract article titles and URLs
    const articlePattern = /\[?\*\*([^\*]{10,100})\*\*[^\]]*\]\((https:\/\/www\.tng\.se\/[^)]+)\)/g;
    const seen = new Set<string>();
    let match;
    
    while ((match = articlePattern.exec(html)) !== null) {
      const title = match[1].trim();
      const url = match[2];
      
      if (seen.has(url) || url.includes('/etikett/')) continue;
      seen.add(url);
      
      // Categorize
      const lowerTitle = title.toLowerCase();
      let category = 'trends';
      if (lowerTitle.includes('ai') || lowerTitle.includes('tech') || lowerTitle.includes('digital') || lowerTitle.includes('verktyg')) {
        category = 'hr_tech';
      } else if (lowerTitle.includes('ledar') || lowerTitle.includes('chef') || lowerTitle.includes('team') || lowerTitle.includes('karriär')) {
        category = 'leadership';
      } else if (lowerTitle.includes('global') || lowerTitle.includes('internationell') || lowerTitle.includes('mångfald')) {
        category = 'international';
      }
      
      items.push({
        title: title.slice(0, 80),
        summary: `Läs mer på TNG.se`,
        source: 'TNG',
        source_url: url,
        category,
      });
      
      if (items.length >= 6) break;
    }
    
    console.log(`Scraped ${items.length} articles from TNG`);
    return items;
  } catch (error) {
    console.error('Error scraping TNG:', error);
    return [];
  }
}

// Use AI to enhance/summarize scraped content
async function enhanceWithAI(items: NewsItem[]): Promise<NewsItem[]> {
  if (items.length === 0) return [];
  
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY, returning items as-is');
    return items;
  }

  try {
    console.log('Enhancing news with AI summaries...');
    
    const prompt = `Här är ${items.length} artikelrubriker från svenska HR-sajter. Skriv en kort, engagerande sammanfattning (max 60 tecken) för varje.

Artiklar:
${items.map((item, i) => `${i + 1}. "${item.title}" (${item.source})`).join('\n')}

Svara ENDAST med JSON:
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
      console.log('AI enhancement failed, using default summaries');
      return items;
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      const summaries = data.summaries || [];
      
      items.forEach((item, i) => {
        if (summaries[i] && summaries[i].length > 5) {
          item.summary = summaries[i].slice(0, 100);
        }
      });
    }
    
    return items;
  } catch (error) {
    console.error('AI enhancement error:', error);
    return items;
  }
}

// Generate AI fallback news (only when scraping fails completely)
async function generateAiNews(today: string): Promise<NewsItem[]> {
  console.log('Generating AI fallback news...');
  
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  
  const prompt = `Du är en HR-nyhetsexpert. Generera 4 korta, positiva och inspirerande nyheter/trender inom rekrytering och HR för idag (${today}).

VIKTIGT:
- Basera på verkliga trender inom HR/rekrytering
- Undvik: Debattartiklar, konkurser, varsel, kriser
- Fokusera på: Innovation, nya metoder, positiva trender

Svara ENDAST med valid JSON:
{
  "news": [
    {"title": "Kort rubrik max 60 tecken", "summary": "En mening max 70 tecken", "category": "hr_tech", "source": "HR-Nytt"},
    {"title": "...", "summary": "...", "category": "trends", "source": "Personnel & Ledarskap"},
    {"title": "...", "summary": "...", "category": "leadership", "source": "SHRM"},
    {"title": "...", "summary": "...", "category": "international", "source": "Recruiting Daily"}
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
    title: item.title?.slice(0, 80) || 'HR-nyhet',
    summary: item.summary?.slice(0, 100) || '',
    source: item.source || 'HR Insight',
    source_url: null,
    category: item.category || 'trends',
  }));
}

// Select best 4 news items (one from each category if possible)
function selectBestNews(items: NewsItem[]): NewsItem[] {
  const selected: NewsItem[] = [];
  const categories = ['hr_tech', 'trends', 'leadership', 'international'];
  
  // First pass: get one from each category
  for (const category of categories) {
    const item = items.find(i => i.category === category && !selected.includes(i));
    if (item) {
      selected.push(item);
    }
  }
  
  // Second pass: fill remaining slots with any items
  for (const item of items) {
    if (selected.length >= 4) break;
    if (!selected.includes(item)) {
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

    console.log('Fetching fresh HR news via scraping...');
    
    let newsItems: NewsItem[] = [];
    let newsSource = 'scraped';

    // Try scraping websites first (in parallel)
    try {
      const [hrnytt, tng] = await Promise.all([
        scrapeHRnytt(),
        scrapeTNG(),
      ]);
      
      newsItems = [...hrnytt, ...tng];
      console.log(`Total scraped items: ${newsItems.length}`);
      
      if (newsItems.length >= 4) {
        // Enhance with AI summaries
        newsItems = await enhanceWithAI(newsItems);
        newsItems = selectBestNews(newsItems);
        newsSource = 'scraped';
        console.log(`Selected ${newsItems.length} items from scraping`);
      }
    } catch (scrapeError) {
      console.error('Scraping failed:', scrapeError);
    }

    // Fallback to AI if scraping didn't provide enough
    if (newsItems.length < 4) {
      try {
        console.log(`Only ${newsItems.length} scraped items, falling back to AI`);
        const aiItems = await generateAiNews(today);
        const combined = [...newsItems, ...aiItems];
        newsItems = selectBestNews(combined);
        newsSource = newsItems.some(i => i.source_url) ? 'hybrid' : 'ai';
      } catch (aiError) {
        console.error('AI fallback failed:', aiError);
        if (newsItems.length === 0) {
          throw new Error('Both scraping and AI failed');
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
