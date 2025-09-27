import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, maxLength = 35 } = await req.json();
    
    if (!title) {
      throw new Error('Title is required');
    }

    // If title is already short enough, return as is
    if (title.length <= maxLength) {
      return new Response(JSON.stringify({ 
        originalTitle: title,
        optimizedTitle: title,
        wasOptimized: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log(`Optimizing title: "${title}" (${title.length} chars) to max ${maxLength} chars`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        max_completion_tokens: 100,
        messages: [
          {
            role: 'system',
            content: `Du är expert på att skriva korta, attraktiva jobbtitlar på svenska. Din uppgift är att korta ner långa jobbtitlar till max ${maxLength} tecken samtidigt som du behåller den viktigaste informationen.

REGLER:
- Behåll alltid yrkestitel/roll (ex: "Säljare", "Utvecklare", "Medarbetare")
- Behåll viktig platsinfo om den finns (ex: "Stockholm", "Göteborg")
- Behåll anställningsform om kritisk (ex: "deltid", "heltid")
- Ta bort onödiga ord som "Vi söker", "Lediga tjänster", "Jobbmöjlighet"
- Korta "medarbetare inom" till bara yrkestiteln
- Använd förkortningar när lämpligt (ex: "inom" → "i")
- Var konkret och direkt
- MÅSTE vara max ${maxLength} tecken
- Behåll svensk grammatik och stavning

Exempel:
"Vi söker medarbetare inom återvinning som medåkare i Stockholm deltid" → "Medåkare återvinning Stockholm deltid"`
          },
          {
            role: 'user',
            content: `Korta ner denna jobbtitel till max ${maxLength} tecken: "${title}"`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const optimizedTitle = data.choices[0].message.content.trim();

    // Verify the optimized title meets our length requirement
    if (optimizedTitle.length > maxLength) {
      console.warn(`Optimized title still too long: ${optimizedTitle.length} chars`);
      // Fallback: truncate with ellipsis
      const fallbackTitle = title.substring(0, maxLength - 3).trim() + '...';
      return new Response(JSON.stringify({
        originalTitle: title,
        optimizedTitle: fallbackTitle,
        wasOptimized: true,
        fallbackUsed: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Optimized: "${title}" → "${optimizedTitle}" (${optimizedTitle.length} chars)`);

    return new Response(JSON.stringify({
      originalTitle: title,
      optimizedTitle: optimizedTitle,
      wasOptimized: true,
      fallbackUsed: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in optimize-job-title function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallback: true 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});