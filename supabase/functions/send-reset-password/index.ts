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
    const tokenHash = urlParams.searchParams.get('token_hash');
    const token = urlParams.searchParams.get('token');
    const type = urlParams.searchParams.get('type');
    const chosenToken = tokenHash || token || '';
    const paramName = tokenHash ? 'token_hash' : 'token';
    const issued = Date.now();
    
    console.log('🔍 RESET URL DEBUG:', {
      originalResetUrl: resetUrl,
      tokenHash,
      token,
      type,
      chosenToken,
      paramName,
      issued
    });
    
    // Använd direkt auth URL med issued timestamp för att kontrollera ålder
    const correctedResetUrl = `https://09c4e686-17a9-467e-89b1-3cf832371d49.lovableproject.com/auth?reset=true&${paramName}=${chosenToken}&type=${type}&issued=${issued}`;
    
    console.log('✅ FINAL RESET URL:', correctedResetUrl);

    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: "Återställ ditt lösenord - Parium",
      text: `Hej!

Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto.

Klicka på länken nedan för att skapa ett nytt lösenord:
${correctedResetUrl}

Denna länk är giltig i 10 minuter. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.

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
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff;">
          
          <div style="max-width: 600px; margin: 0 auto; text-align: center; padding: 40px 20px;">
            
            <p style="color: #333333; margin: 0 0 15px 0; font-size: 16px;">
              Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto.
            </p>
            
            <p style="color: #333333; margin: 0 0 30px 0; font-size: 16px;">
              Klicka på knappen nedan för att skapa ett nytt lösenord.
            </p>
            
            <!-- CTA Button -->
            <div style="margin: 30px 0;">
              <a href="${correctedResetUrl}" 
                 style="display: inline-block; background-color: #1a237e; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Återställ lösenord
              </a>
            </div>
            
            <!-- Security Notice -->
            <div style="background-color: #e2e8f0; padding: 20px; margin: 30px 0; border-radius: 8px;">
              <p style="color: #4a5568; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">
                Säkerhetsmeddelande
              </p>
              <p style="color: #718096; font-size: 14px; margin: 0;">
                Denna länk är giltig i 10 minuter. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.
              </p>
            </div>
            
            <!-- Alternative link -->
            <div style="margin: 30px 0;">
              <p style="color: #718096; font-size: 12px; margin: 0 0 10px 0;">
                Fungerar inte knappen? Kopiera länken nedan:
              </p>
              <p style="color: #4299e1; font-size: 12px; word-break: break-all; margin: 0;">
                ${correctedResetUrl}
              </p>
            </div>
            
            <!-- Footer -->
            <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              <p style="color: #4a5568; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">
                Parium AB · Stockholm
              </p>
              <p style="color: #718096; font-size: 12px; margin: 0;">
                Du får detta mail för att du begärde ett återställnings mail i Parium-appen.
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