import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('Parsing search query:', query);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Du är en smart jobbsökningsassistent. Din uppgift är att tolka användarens naturliga sökning och extrahera strukturerad information.

Extrahera följande från användarens sökning:
- jobTitle: Jobbtitel eller yrkesområde (t.ex. "lastbilschaufför", "lagerarbetare", "försäljare")
- location: Stad eller plats (t.ex. "Stockholm", "Göteborg", "Malmö")
- employmentType: Anställningstyp om nämnt (t.ex. "heltid", "deltid", "vikariat")

Om något inte nämns, lämna det tomt.

Exempel:
"Lastbilschaufför i Stockholm" → { jobTitle: "lastbilschaufför", location: "Stockholm", employmentType: "" }
"Lagerarbete Göteborg heltid" → { jobTitle: "lagerarbete", location: "Göteborg", employmentType: "heltid" }
"Försäljare" → { jobTitle: "försäljare", location: "", employmentType: "" }
"Jobb i Malmö" → { jobTitle: "", location: "Malmö", employmentType: "" }

Svara ENDAST med valid JSON i formatet: {"jobTitle": "...", "location": "...", "employmentType": "..."}`
          },
          {
            role: "user",
            content: query
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_search",
              description: "Extract structured job search parameters",
              parameters: {
                type: "object",
                properties: {
                  jobTitle: {
                    type: "string",
                    description: "The job title or occupation being searched for"
                  },
                  location: {
                    type: "string",
                    description: "The city or location for the job search"
                  },
                  employmentType: {
                    type: "string",
                    description: "The type of employment (heltid, deltid, vikariat, etc.)"
                  }
                },
                required: ["jobTitle", "location", "employmentType"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "parse_search" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: "För många förfrågningar. Försök igen om en stund." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(
          JSON.stringify({ error: "AI-tjänsten kräver betalning. Kontakta support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    console.log('AI Response:', JSON.stringify(data));

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      console.log('Parsed search:', parsed);
      
      return new Response(
        JSON.stringify({
          jobTitle: parsed.jobTitle || "",
          location: parsed.location || "",
          employmentType: parsed.employmentType || ""
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback if no tool call
    throw new Error("Could not parse search query");

  } catch (error) {
    console.error("Error in parse-job-search:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        jobTitle: "",
        location: "",
        employmentType: ""
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
