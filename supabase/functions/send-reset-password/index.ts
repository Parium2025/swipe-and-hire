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

interface ResetPasswordRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ResetPasswordRequest = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ 
        error: "Email krävs" 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log(`Sending password reset email to: ${email}`);

    // Generate reset password link through Supabase Auth
    // Använd direkt URL istället för redirectTo för att undvika Site URL problem
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email
    });

    if (error) {
      console.error('Error generating reset link:', error);
      throw error;
    }

    const resetUrl = data.properties?.action_link;

    if (!resetUrl) {
      throw new Error('No reset URL generated');
    }

    // Skapa en enklare, kortare URL som är mer kompatibel med Yahoo
    const urlParams = new URL(resetUrl);
    const token = urlParams.searchParams.get('token');
    
    const fullRecoveryUrl = `https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth?token=${token}&type=recovery`;
    
    // Skapa en kortare redirect-URL som fungerar med alla e-postklienter
    const encodedUrl = btoa(fullRecoveryUrl);
    const correctedResetUrl = `https://rvtsfnaqlnggfkoqygbm.supabase.co/functions/v1/redirect-recovery?t=${encodedUrl}`;

    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>", // Använder din verifierade domän
      to: [email],
      subject: "Återställ ditt lösenord - Parium",
      text: `Hej!

Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto.

Klicka på länken nedan för att skapa ett nytt lösenord:
${correctedResetUrl}

Denna länk är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.

Med vänliga hälsningar,
Parium Team

Parium AB, Stockholm
support@parium.se`,
      html: `
        <!DOCTYPE html>
        <html lang="sv">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light">
          <meta name="supported-color-schemes" content="light">
          <title>Lösenordsåterställning</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
          
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 0;">
            <tr>
              <td align="center" style="padding: 20px 0;">
                
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #1E3A8A; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">
                        Lösenordsåterställning
                      </h1>
                      <p style="color: #ffffff; margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">
                        Parium
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      
                      <p style="color: #333333; margin: 0 0 24px 0; font-size: 16px; line-height: 1.5;">
                        Hej!
                      </p>
                      
                      <p style="color: #333333; margin: 0 0 24px 0; font-size: 16px; line-height: 1.5;">
                        Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto. Klicka på knappen nedan för att skapa ett nytt lösenord.
                      </p>
                      
                      <!-- CTA Button -->
                      <div style="text-align: center; margin: 32px 0;">
                        <a href="${correctedResetUrl}" 
                           style="display: inline-block; background-color: #1E3A8A; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; text-align: center; max-width: 200px; line-height: 1.2;">
                          Återställ lösenord
                        </a>
                      </div>
                      
                      <!-- Security Notice -->
                      <div style="background-color: #f8f9fa; border-left: 4px solid #1E3A8A; padding: 16px; margin: 24px 0; border-radius: 4px;">
                        <p style="color: #1E3A8A; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">
                          Säkerhetsmeddelande
                        </p>
                        <p style="color: #666666; font-size: 14px; margin: 0; line-height: 1.4;">
                          Denna länk är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.
                        </p>
                      </div>
                      
                      <!-- Alternative link -->
                      <div style="margin: 24px 0; padding: 16px; background-color: #f8f9fa; border-radius: 4px;">
                        <p style="color: #666666; font-size: 13px; margin: 0 0 8px 0;">
                          Fungerar inte knappen? Kopiera och klistra in länken nedan i din webbläsare:
                        </p>
                        <p style="color: #0066cc; font-size: 13px; word-break: break-all; margin: 0; font-family: monospace;">
                          ${correctedResetUrl}
                        </p>
                      </div>
                      
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 24px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                      <p style="color: #333333; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">
                        Parium AB
                      </p>
                      <p style="color: #666666; font-size: 13px; margin: 0;">
                        Stockholm, Sverige • support@parium.se
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

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      id: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-reset-password:", error);
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