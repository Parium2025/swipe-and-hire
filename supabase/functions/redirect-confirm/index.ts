import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  
  console.log('Redirect-confirm called with token:', token);
  
  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  // Skapa en HTML-sida som omdirigerar med JavaScript
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Bekräftar konto...</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px;
          background: linear-gradient(135deg, #1E3A8A, #3B82F6);
          color: white;
          min-height: 100vh;
          margin: 0;
        }
        .container {
          max-width: 400px;
          margin: 0 auto;
          background: rgba(255,255,255,0.1);
          padding: 40px;
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }
        .spinner {
          border: 3px solid rgba(255,255,255,0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Parium</h1>
        <div class="spinner"></div>
        <p>Bekräftar ditt konto...</p>
        <p>Du omdirigeras automatiskt.</p>
      </div>
      <script>
        console.log('Redirecting to confirm page...');
        setTimeout(() => {
          window.location.href = 'https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/confirm?confirm=${token}';
        }, 2000);
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
};

serve(handler);