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

    // 1. Skapa användare utan bekräftelse
    const { data: user, error: signupError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Vi hanterar bekräftelse manuellt
      user_metadata: data || {}
    });

    if (signupError) {
      // Handle existing user case
      if (signupError.message.includes("already been registered") || signupError.message.includes("User already registered")) {
        return new Response(JSON.stringify({ 
          error: "E-post redan registrerad. Det finns redan ett konto med denna e-postadress. Försök logga in istället." 
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
    
    // 3. Spara token i databasen (du kan skapa en tabell för detta)
    // För nu: skicka e-post direkt
    
    const confirmationUrl = `${req.headers.get('origin')}/auth?confirm=${confirmationToken}&email=${encodeURIComponent(email)}`;

    // 4. Skicka bekräftelsemejl via Resend
    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: "Bekräfta ditt Parium-konto",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bekräfta ditt Parium-konto</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 0 auto;">
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="color: #1a237e; margin: 0 0 24px 0; font-size: 28px; font-weight: 600;">Välkommen till Parium!</h1>
                      <p style="color: #475569; font-size: 16px; line-height: 24px; margin: 0 0 32px 0;">
                        Tack för att du skapade ett konto. För att komma igång behöver du bekräfta din e-postadress genom att klicka på knappen nedan.
                      </p>
                      <div style="text-align: center; margin: 32px 0;">
                        <a href="${confirmationUrl}" 
                           style="background-color: #1a237e; color: white; padding: 16px 32px; 
                                  text-decoration: none; border-radius: 8px; display: inline-block; 
                                  font-weight: 600; font-size: 16px;">
                          Bekräfta e-postadress
                        </a>
                      </div>
                      <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 32px 0 0 0;">
                        Om knappen inte fungerar kan du kopiera och klistra in denna länk i din webbläsare:<br>
                        <span style="word-break: break-all; color: #1a237e;">${confirmationUrl}</span>
                      </p>
                      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
                      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        Detta e-postmeddelande skickades till ${email} eftersom du registrerade dig för ett Parium-konto.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
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