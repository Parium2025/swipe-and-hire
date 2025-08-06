import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  
  console.log('Redirect-confirm called with token:', token);
  
  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  // Direkt HTTP-redirect
  const redirectUrl = `https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/confirm?confirm=${token}`;
  
  console.log('Redirecting to:', redirectUrl);
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl,
      'Cache-Control': 'no-cache',
    },
  });
};

serve(handler);