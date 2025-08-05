import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { Resend } from "npm:resend@2.0.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignupRequest {
  email: string;
  password: string;
  data?: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, data }: SignupRequest = await req.json();

    console.log(`Attempting signup for email: ${email}`);

    // 1. Först, försök ta bort befintlig användare om den finns
    try {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (!listError && listData?.users) {
        const existingUser = listData.users.find(u => u.email === email);
        
        if (existingUser) {
          console.log(`Found existing user ${existingUser.id}, deleting first...`);
          
          // Ta bort från relaterade tabeller
          await supabase.from('email_confirmations').delete().eq('user_id', existingUser.id);
          await supabase.from('profiles').delete().eq('user_id', existingUser.id);
          await supabase.from('user_roles').delete().eq('user_id', existingUser.id);
          
          // Ta bort användaren
          await supabase.auth.admin.deleteUser(existingUser.id);
          console.log('Existing user deleted successfully');
        }
      }
    } catch (cleanupError) {
      console.error('Cleanup error (continuing anyway):', cleanupError);
    }

    // 2. Skapa användare utan bekräftelse
    const { data: user, error: signupError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Vi hanterar bekräftelse manuellt
      user_metadata: data || {}
    });

    console.log('Signup result:', { userId: user?.user?.id, error: signupError?.message });

    if (signupError) {
      console.error('Signup error details:', signupError);
      
      // Handle existing user case (fallback)
      if (signupError.message.includes("already been registered") || 
          signupError.message.includes("User already registered") ||
          signupError.message.includes("email_exists")) {
        
        return new Response(JSON.stringify({ 
          error: "E-post redan registrerad. Vänta en minut och försök igen, eller använd en annan e-postadress." 
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }
      throw new Error(signupError.message);
    }

    // 2. Skapa bekräftelsetoken
    const confirmationToken = crypto.randomUUID();
    
    // 3. Spara token i databasen
    const { error: tokenError } = await supabase
      .from('email_confirmations')
      .insert({
        user_id: user.user.id,
        email,
        token: confirmationToken
      });

    if (tokenError) {
      console.error('Error saving confirmation token:', tokenError);
      // Ta bort användaren om token-sparandet misslyckades
      await supabase.auth.admin.deleteUser(user.user.id);
      throw new Error('Fel vid skapande av bekräftelsetoken');
    }
    
    const confirmationUrl = `${req.headers.get('origin')}/auth?confirm=${confirmationToken}`;

    // 4. Skicka bekräftelsemejl via Resend
    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: "Bekräfta ditt konto – Parium",
      html: `
        <!DOCTYPE html>
        <html lang="sv">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bekräfta ditt konto – Parium</title>
          <style>
            body {
              background-color: #F9FAFB;
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 0;
              color: #111827;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              padding: 24px;
              border-radius: 12px;
            }
            .header {
              font-size: 24px;
              font-weight: 600;
              text-align: center;
              margin-bottom: 24px;
            }
            .intro {
              font-size: 16px;
              line-height: 1.5;
              margin-bottom: 32px;
              text-align: center;
            }
            .button {
              display: inline-block;
              background-color: #1E3A8A;
              color: #ffffff;
              text-decoration: none;
              padding: 14px 28px;
              border-radius: 10px;
              font-weight: 600;
              font-size: 16px;
              text-align: center;
              margin: 0 auto;
              display: block;
              width: fit-content;
            }
            .features {
              margin-top: 40px;
              margin-bottom: 32px;
              font-size: 16px;
            }
            .features li {
              margin-bottom: 12px;
            }
            .footer-text {
              font-size: 14px;
              color: #6B7280;
              text-align: center;
              margin-top: 40px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">Framtiden börjar med ett swipe.</div>
            <div class="intro">
              Hej och varmt välkommen till <strong>Parium</strong> – appen som gör jobbsök enkelt, snabbt och mänskligt.<br><br>
              Du är bara ett klick från att börja upptäcka möjligheter som faktiskt passar dig.
            </div>
            <a href="${confirmationUrl}" class="button">Bekräfta mitt konto</a>
            <ul class="features">
              <li>🎯 Matcha med jobb som passar dig</li>
              <li>⚡ Swipea, ansök och gå vidare på sekunder</li>
              <li>💎 Få tillgång till smarta verktyg för din karriär</li>
            </ul>
            <div class="footer-text">
              Parium AB · Stockholm<br>
              Du får detta mail för att du registrerat ett konto i Parium-appen.
            </div>
          </div>
        </body>
        </html>
      `,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    });

    console.log("Custom signup email sent:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Användare skapad. Kolla din e-post för bekräftelse.",
      user: user.user
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in custom-signup:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);