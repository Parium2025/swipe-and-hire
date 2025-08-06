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
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    // Bekräfta e-post direkt här
    const { data: confirmation, error: confirmError } = await supabase
      .from('email_confirmations')
      .select('*')
      .eq('token', token)
      .single();

    if (confirmError || !confirmation) {
      return new Response(getErrorPage('Ogiltigt eller utgånget bekräftelsetoken.'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (confirmation.confirmed_at) {
      return new Response(getSuccessPage('Ditt konto är redan aktiverat!', true), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
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
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
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

    return new Response(getSuccessPage('Ditt konto har aktiverats!'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  } catch (error) {
    console.error('Confirmation error:', error);
    return new Response(getErrorPage('Ett oväntat fel inträffade.'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
};

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
        <div class="icon">✅</div>
        <h1>Parium</h1>
        <h2>${message}</h2>
        <p>Du kan nu logga in i Parium och börja swipa dig fram till din nästa jobbmöjlighet.</p>
        <a href="https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth" class="button">
          Logga in
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
        <a href="https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth" class="button">
          Tillbaka till inloggning
        </a>
      </div>
    </body>
    </html>
  `;
}

serve(handler);