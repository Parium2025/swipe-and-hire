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
    
    console.log('🔍 RESET-REDIRECT FUNKTIONEN KALLAD!');
    console.log('Reset redirect called with:', { 
      token: !!token, 
      type, 
      issued,
      fullUrl: req.url,
      allParams: Object.fromEntries(url.searchParams.entries())
    });

    // För GAMLA länkar utan issued parameter - betrakta som expired
    if (!issued) {
      console.log('❌ GAMMAL RESET LINK utan issued timestamp - Redirecting to expired page');
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "https://parium.se/auth?reset=true&expired=true",
          ...corsHeaders,
        },
      });
    }

    // Kontrollera om länken är över 1.5 minuter gammal (90 000 ms)
    const issuedTime = parseInt(issued);
    const currentTime = Date.now();
    const timeDiff = currentTime - issuedTime;
    const expirationMs = 90 * 1000; // 1.5 minuter
    
    console.log('Time check:', { issuedTime, currentTime, timeDiff, expirationMs });
    
    if (timeDiff > expirationMs) {
      console.log('❌ RESET LINK EXPIRED (över 1.5 minuter) - Redirecting to expired page');
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "https://parium.se/auth?reset=true&expired=true",
          ...corsHeaders,
        },
      });
    }

    // Om länken är YNGRE än 1.5 minuter → Redirect till auth med token
    // Token-användning kontrolleras INTE här - det sker först när användaren faktiskt 
    // försöker uppdatera lösenordet i Auth.tsx handlePasswordReset
    if (token) {
      let redirectUrl = "https://parium.se/auth?reset=true";
      const paramName = url.searchParams.get('token_hash') ? 'token_hash' : 'token';
      redirectUrl += `&${paramName}=${token}`;
      if (type) redirectUrl += `&type=${type}`;
      if (issued) redirectUrl += `&issued=${issued}`;
      
      console.log(`✅ LÄNK GILTIG (under 1.5 min) - Redirecting to: ${redirectUrl}`);
      return new Response(null, {
        status: 302,
        headers: { "Location": redirectUrl, ...corsHeaders },
      });
    }
    
    // Om ingen token, redirect till auth
    console.log(`✅ NO TOKEN - Redirecting to auth page`);
    let redirectUrl = "https://parium.se/auth?reset=true";
    if (issued) redirectUrl += `&issued=${issued}`;
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
        "Location": "https://parium.se/auth?reset=true&expired=true",
        ...corsHeaders,
      },
    });
  }
};

serve(handler);