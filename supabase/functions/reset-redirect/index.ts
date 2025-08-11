import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');
    const issued = url.searchParams.get('issued');
    
    console.log('Reset redirect called with:', { token: !!token, type, issued });

    // För GAMLA länkar utan issued parameter - betrakta som expired
    if (!issued) {
      console.log('❌ GAMMAL RESET LINK utan issued timestamp - Redirecting to expired page');
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth?reset=true&expired=true",
          ...corsHeaders,
        },
      });
    }

    // Kontrollera om länken är över 10 minuter gammal (600000 ms)
    const issuedTime = parseInt(issued);
    const currentTime = Date.now();
    const timeDiff = currentTime - issuedTime;
    const tenMinutesInMs = 10 * 60 * 1000; // 10 minuter
    
    console.log('Time check:', { issuedTime, currentTime, timeDiff, tenMinutesInMs });
    
    if (timeDiff > tenMinutesInMs) {
      console.log('❌ RESET LINK EXPIRED - Redirecting to expired page');
      // Redirect till expired sida
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth?reset=true&expired=true",
          ...corsHeaders,
        },
      });
    }

    // Kontrollera om token redan har använts genom att testa den
    try {
      if (token) {
        console.log('🔍 Testing token validity...');
        
        // Försök att hämta användarens session med token utan att konsumera den
        const { data, error } = await supabase.auth.getUser(token);
        
        console.log('Token test result:', { data: !!data.user, error: error?.message });
        
        // Om vi får en specifik feltyp betyder det att token är använd/invalid
        if (error) {
          const errorMsg = error.message.toLowerCase();
          console.log('❌ TOKEN ERROR - Message:', errorMsg);
          
          if (errorMsg.includes('invalid') || errorMsg.includes('expired') || errorMsg.includes('used') || errorMsg.includes('consumed')) {
            console.log('❌ TOKEN ALREADY USED - Redirecting to used page');
            return new Response(null, {
              status: 302,
              headers: {
                "Location": "https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth?reset=true&used=true",
                ...corsHeaders,
              },
            });
          }
        }
      }
    } catch (testError: any) {
      console.log('Token test error:', testError.message);
      // Om vi får ett oväntat fel, behandla som använd token
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth?reset=true&used=true",
          ...corsHeaders,
        },
      });
    }

    // Om länken är giltig, bygg den korrekta URL:en för återställning
    let redirectUrl = "https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth?reset=true";
    
    if (token) {
      const paramName = url.searchParams.get('token_hash') ? 'token_hash' : 'token';
      redirectUrl += `&${paramName}=${token}`;
    }
    
    if (type) {
      redirectUrl += `&type=${type}`;
    }
    
    console.log(`✅ VALID RESET LINK - Redirecting to: ${redirectUrl}`);

    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl,
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in reset-redirect:", error);
    
    // Fallback redirect till auth page med expired status
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth?reset=true&expired=true",
        ...corsHeaders,
      },
    });
  }
};

serve(handler);