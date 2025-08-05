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
      subject: "✨ Välkommen till Parium - Bekräfta ditt premium-konto",
      html: `
        <!DOCTYPE html>
        <html lang="sv">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Välkommen till Parium</title>
          <!--[if mso]>
            <noscript>
              <xml>
                <o:OfficeDocumentSettings>
                  <o:AllowPNG/>
                  <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
              </xml>
            </noscript>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
          <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
            Bekräfta ditt Parium-konto och börja din premium-upplevelse idag! ✨
          </div>
          
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px;">
            <tr>
              <td style="text-align: center;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; max-width: 600px; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2); overflow: hidden;">
                  
                  <!-- Header with gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); padding: 0; text-align: center; position: relative;">
                      <div style="padding: 50px 40px; color: white; position: relative;">
                        <div style="display: inline-block; width: 80px; height: 80px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; margin-bottom: 24px; position: relative;">
                          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 36px; font-weight: bold;">P</div>
                        </div>
                        <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Välkommen till Parium</h1>
                        <p style="margin: 12px 0 0 0; font-size: 18px; opacity: 0.9; font-weight: 300;">Din premium karriärplattform</p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Main content -->
                  <tr>
                    <td style="padding: 60px 40px;">
                      <div style="text-align: center; margin-bottom: 40px;">
                        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #1a202c; line-height: 1.3;">
                          Tack för att du valde Parium! 🎉
                        </h2>
                        <p style="margin: 0; font-size: 16px; color: #4a5568; line-height: 1.6;">
                          Du är bara ett klick ifrån att upptäcka framtidens jobbsökningsupplevelse. 
                          Bekräfta din e-postadress för att komma igång.
                        </p>
                      </div>
                      
                      <!-- CTA Button -->
                      <div style="text-align: center; margin: 40px 0;">
                        <a href="${confirmationUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); 
                                  color: white; text-decoration: none; padding: 18px 40px; 
                                  border-radius: 50px; font-weight: 600; font-size: 16px; 
                                  box-shadow: 0 8px 25px rgba(26, 35, 126, 0.3); 
                                  transition: all 0.3s ease;">
                          ✨ Bekräfta mitt konto
                        </a>
                      </div>
                      
                      <!-- Features -->
                      <div style="margin: 50px 0; text-align: left;">
                        <h3 style="margin: 0 0 24px 0; font-size: 18px; font-weight: 600; color: #1a202c; text-align: center;">
                          Vad väntar dig:
                        </h3>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                              <span style="font-size: 20px; margin-right: 12px;">🎯</span>
                              <span style="font-size: 14px; color: #4a5568; font-weight: 500;">Intelligenta jobbrekommendationer</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                              <span style="font-size: 20px; margin-right: 12px;">⚡</span>
                              <span style="font-size: 14px; color: #4a5568; font-weight: 500;">Snabb och enkel ansökningsprocess</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 0;">
                              <span style="font-size: 20px; margin-right: 12px;">🚀</span>
                              <span style="font-size: 14px; color: #4a5568; font-weight: 500;">Premium karriärverktyg</span>
                            </td>
                          </tr>
                        </table>
                      </div>
                      
                      <!-- Alternative link -->
                      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 40px 0; text-align: center;">
                        <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b; font-weight: 500;">
                          Fungerar knappen inte? Kopiera denna länk:
                        </p>
                        <p style="margin: 0; word-break: break-all; font-size: 12px; color: #1a237e; background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                          ${confirmationUrl}
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: #9ca3af;">
                        Detta meddelande skickades till <strong>${email}</strong>
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        © 2024 Parium. Framtidens karriärplattform.
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