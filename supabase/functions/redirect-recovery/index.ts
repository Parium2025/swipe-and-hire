import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('t');
    
    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    // Decode the token to get the original recovery URL
    const decodedUrl = atob(token);
    
    console.log(`Redirecting to: ${decodedUrl}`);

    // Create redirect response
    return new Response(null, {
      status: 302,
      headers: {
        "Location": decodedUrl,
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in redirect-recovery:", error);
    
    // Fallback redirect to auth page
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "https://swipe-and-hire.lovable.app/auth",
        ...corsHeaders,
      },
    });
  }
};

serve(handler);