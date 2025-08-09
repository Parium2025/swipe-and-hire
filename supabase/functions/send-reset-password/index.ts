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

    // För Yahoo Mail kompatibilitet - använd direkta URL:en istället för redirect
    const urlParams = new URL(resetUrl);
    const token = urlParams.searchParams.get('token');
    const type = urlParams.searchParams.get('type');
    
    // Använd den direkta Supabase recovery URL:en som är kortare och mer kompatibel
    const correctedResetUrl = `https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth?token=${token}&type=${type}`;

    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>", // Din verifierade domän
      to: [email],
      subject: "Återställ ditt lösenord - Parium",
      text: `Hej!

Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto.

Klicka på länken nedan för att skapa ett nytt lösenord:
${correctedResetUrl}

Denna länk är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.

Med vänliga hälsningar,
Parium Team

Parium AB, Stockholm`,
      html: `
        <!DOCTYPE html>
        <html lang="sv">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Lösenordsåterställning</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5; line-height: 1.4;">
          
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background-color: #1E3A8A; padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">
                Lösenordsåterställning
              </h1>
              <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">
                Parium
              </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px;">
              
              <p style="color: #333333; margin: 0 0 15px 0; font-size: 14px;">
                Hej!
              </p>
              
              <p style="color: #333333; margin: 0 0 25px 0; font-size: 14px;">
                Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto. Klicka på knappen nedan för att skapa ett nytt lösenord.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 25px 0;">
                <a href="${correctedResetUrl}" 
                   style="display: inline-block; background-color: #1E3A8A; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-size: 14px; font-weight: 600;">
                  Återställ lösenord
                </a>
              </div>
              
              <!-- Security Notice -->
              <div style="background-color: #f8f9fa; border-left: 3px solid #1E3A8A; padding: 15px; margin: 20px 0; border-radius: 3px;">
                <p style="color: #1E3A8A; font-size: 13px; margin: 0 0 5px 0; font-weight: 600;">
                  Säkerhetsmeddelande
                </p>
                <p style="color: #666666; font-size: 12px; margin: 0;">
                  Denna länk är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.
                </p>
              </div>
              
              <!-- Alternative link -->
              <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 3px;">
                <p style="color: #666666; font-size: 11px; margin: 0 0 5px 0;">
                  Fungerar inte knappen? Kopiera länken nedan:
                </p>
                <p style="color: #0066cc; font-size: 10px; word-break: break-all; margin: 0; font-family: monospace;">
                  ${correctedResetUrl}
                </p>
              </div>
              
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #333333; font-size: 12px; margin: 0 0 5px 0; font-weight: 600;">
                Parium AB
              </p>
              <p style="color: #666666; font-size: 11px; margin: 0;">
                Stockholm, Sverige
              </p>
            </div>
            
          </div>
          
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