import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  
  console.log('Confirm page accessed with token:', token);
  
  if (!token) {
    return new Response(getErrorPage('Ingen bekräftelsetoken hittades.'), { 
      status: 400,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }

  try {
    // Först kolla om användarens e-postbekräftelse är klar
    const { data: confirmation, error: confirmError } = await supabase
      .from('email_confirmations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    // Om token inte finns i databasen, omdirigera till "redan aktiverat"
    if (!confirmation) {
      console.log('Token not found in database, user probably already confirmed');
      return new Response(getSuccessPage('Ditt konto är redan aktiverat. Du kan logga in direkt.', true), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    if (confirmation.confirmed_at) {
      console.log('Token already confirmed:', token);
      return new Response(getSuccessPage('Ditt konto är redan aktiverat. Du kan logga in direkt.', true), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Bekräfta användaren
    const { error: updateError } = await supabase
      .from('email_confirmations')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('token', token);

    if (updateError) {
      console.error('Error updating confirmation:', updateError);
      return new Response(getErrorPage('Ett fel inträffade vid bekräftelse.'), { 
        status: 500,
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Aktivera användaren i Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      confirmation.user_id,
      { email_confirm: true }
    );

    if (authError) {
      console.error('Error confirming user:', authError);
    }

    console.log('Email confirmed successfully for token:', token);
    
    // Visa den fina bekräftelsesidan direkt
    return new Response(getSuccessPage('Grattis! Ditt konto har nu aktiverats. Du kan nu logga in och börja använda Parium.'), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Confirmation error:', error);
    return new Response(getErrorPage('Ett oväntat fel inträffade.'), { 
      status: 500,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
};

serve(handler);

function getSuccessPage(message: string, alreadyConfirmed = false): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Konto ${alreadyConfirmed ? 'redan aktiverat' : 'aktiverat'} - Parium</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          text-align: center; 
          padding: 20px;
          background: linear-gradient(135deg, #1E3A8A, #3B82F6);
          color: white;
          min-height: 100vh;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 500px;
          background: rgba(255,255,255,0.1);
          padding: 40px;
          border-radius: 16px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 30px;
          opacity: 0.9;
        }
        .icon {
          font-size: 80px;
          margin-bottom: 20px;
          animation: bounce 2s infinite;
        }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
        h1 {
          margin: 20px 0;
          font-size: 32px;
          font-weight: 700;
        }
        p {
          margin: 20px 0;
          font-size: 18px;
          line-height: 1.6;
          opacity: 0.9;
        }
        .success-text {
          font-size: 20px;
          font-weight: 600;
          margin: 25px 0;
          color: #10B981;
          background: rgba(16, 185, 129, 0.1);
          padding: 15px;
          border-radius: 8px;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #10B981, #059669);
          color: white;
          padding: 16px 32px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 16px;
          margin-top: 30px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
        }
        .subtitle {
          font-size: 16px;
          opacity: 0.8;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Parium</div>
        <div class="icon">✅</div>
        <h1>${alreadyConfirmed ? 'Redan aktiverat!' : 'Välkommen!'}</h1>
        <div class="success-text">
          ${message}
        </div>
        <p>Du kan nu logga in i Parium och börja swipa dig fram till din nästa jobbmöjlighet.</p>
        <p class="subtitle">Framtiden börjar med ett swipe 🚀</p>
        <a href="https://swipe-and-hire.lovable.app/auth" class="button">
          Logga in nu
        </a>
      </div>
    </body>
    </html>
  `;
}

function getErrorPage(message: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Bekräftelsefel - Parium</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 20px;
          background: linear-gradient(135deg, #1E3A8A, #3B82F6);
          color: white;
          min-height: 100vh;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 500px;
          background: rgba(255,255,255,0.1);
          padding: 40px;
          border-radius: 12px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          margin: 20px 0;
          font-size: 28px;
        }
        p {
          margin: 15px 0;
          font-size: 16px;
          line-height: 1.5;
        }
        .button {
          display: inline-block;
          background: white;
          color: #1E3A8A;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          margin-top: 20px;
          transition: background 0.3s;
        }
        .button:hover {
          background: #f0f0f0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <h1>Parium</h1>
        <h2>Bekräftelsefel</h2>
        <p>${message}</p>
        <p>Du kan försöka registrera dig igen eller kontakta support om problemet kvarstår.</p>
        <a href="https://swipe-and-hire.lovable.app/auth" class="button">
          Tillbaka till inloggning
        </a>
      </div>
    </body>
    </html>
  `;
}

serve(handler);