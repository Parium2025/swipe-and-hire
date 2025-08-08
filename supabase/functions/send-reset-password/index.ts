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
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${req.headers.get('origin')}/auth?reset=true`
      }
    });

    if (error) {
      console.error('Error generating reset link:', error);
      throw error;
    }

    const resetUrl = data.properties?.action_link;

    if (!resetUrl) {
      throw new Error('No reset URL generated');
    }

    const emailResponse = await resend.emails.send({
      from: "Parium Team <noreply@parium.se>",
      to: [email],
      subject: "Återställ ditt lösenord - Parium",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 20px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          
          <!-- Simple container -->
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            
            <!-- Header -->
            <div style="background-color: #1E3A8A; padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Återställ ditt lösenord</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">Parium</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="color: #333333; margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">
                Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto.<br>
                Klicka på knappen nedan för att skapa ett nytt lösenord.
              </p>
              
              <!-- Button with bulletproof mobile centering -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="21%" stroke="f" fillcolor="#1E3A8A">
                    <w:anchorlock/>
                    <center>
                    <![endif]-->
                     <a href="${resetUrl}" 
                       style="background-color: #1E3A8A; border-radius: 5px; color: #ffffff; display: inline-block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none; mso-hide: all;">
                       Återställ lösenord
                     </a>
                    <!--[if mso]>
                    </center>
                    </v:roundrect>
                    <![endif]-->
                  </td>
                </tr>
              </table>
              
              <!-- Security notice -->
              <div style="background-color: #e8eaf6; border: 1px solid #1E3A8A; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="color: #1E3A8A; font-size: 14px; margin: 0; text-align: center; font-weight: bold;">
                  ⚠️ Säkerhetsnotis
                </p>
                <p style="color: #1E3A8A; font-size: 14px; margin: 5px 0 0 0; text-align: center;">
                  Denna länk är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.
                </p>
              </div>
              
              <!-- Alternative link -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
                <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                  Fungerar inte knappen? Kopiera länken nedan:
                </p>
                <p style="color: #0066cc; font-size: 14px; word-break: break-all; margin: 0;">
                  ${resetUrl}
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #333333; font-size: 16px; margin: 0; font-weight: bold;">
                Parium AB · Stockholm
              </p>
              <p style="color: #666666; font-size: 14px; margin: 10px 0 0 0;">
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