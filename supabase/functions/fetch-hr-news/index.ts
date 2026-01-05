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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if we already have news for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingNews } = await supabase
      .from('daily_hr_news')
      .select('*')
      .eq('news_date', today)
      .order('order_index');

    if (existingNews && existingNews.length >= 4) {
      console.log('News already exists for today, returning cached news');
      return new Response(JSON.stringify({ news: existingNews, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('Fetching fresh HR news...');

    // Use Lovable AI to generate HR news summaries
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
      "source": "Källans namn",
      "category": "hr_tech"
    },
    {
      "title": "...",
      "summary": "...",
      "source": "...",
      "category": "trends"
    },
    {
      "title": "...",
      "summary": "...",
      "source": "...",
      "category": "leadership"
    },
    {
      "title": "...",
      "summary": "...",
      "source": "...",
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
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from the response (handle markdown code blocks)
    let newsData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        newsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse news data");
    }

    if (!newsData.news || !Array.isArray(newsData.news)) {
      throw new Error("Invalid news format");
    }

    // Delete old news for today (if partial) and insert new
    await supabase
      .from('daily_hr_news')
      .delete()
      .eq('news_date', today);

    // Insert new news with category styling
    const newsToInsert = newsData.news.map((item: any, index: number) => {
      const categoryConfig = CATEGORIES.find(c => c.key === item.category) || CATEGORIES[index % 4];
      return {
        title: item.title?.slice(0, 100) || 'HR-nyhet',
        summary: item.summary?.slice(0, 150) || '',
        source: item.source?.slice(0, 50) || 'HR Insight',
        source_url: null,
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

    console.log('Successfully generated and saved', insertedNews?.length, 'news items');

    return new Response(JSON.stringify({ news: insertedNews, cached: false }), {
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
