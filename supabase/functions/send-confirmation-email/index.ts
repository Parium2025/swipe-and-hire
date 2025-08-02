import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  email: string;
  confirmationUrl: string;
  type: 'signup' | 'reset';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, confirmationUrl, type }: ConfirmationEmailRequest = await req.json();

    console.log(`Sending ${type} email to: ${email}`);

    let subject: string;
    let htmlContent: string;

    if (type === 'signup') {
      subject = "Välkommen till Parium - Bekräfta din e-post";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          
          <!-- Simple container -->
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            
            <!-- Header -->
            <div style="background-color: #3b82f6; padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Välkommen till Parium!</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">Framtiden börjar med ett swipe</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="color: #333333; margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">
                Parium handlar om att göra jobbsökande så enkelt som det borde vara.<br>
                Vi behöver bara bekräfta din e-post – sen är du igång.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" 
                   style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-size: 16px; font-weight: bold;">
                  👉 Bekräfta min e-postadress
                </a>
              </div>
              
              <p style="color: #666666; margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; text-align: center;">
                Tack för att du är med oss från början.<br>
                Det här kan bli starten på något riktigt bra.
              </p>
              
              <!-- Alternative link -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
                <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                  Fungerar inte knappen? Kopiera länken nedan:
                </p>
                <p style="color: #0066cc; font-size: 14px; word-break: break-all; margin: 0;">
                  ${confirmationUrl}
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                Fick du detta mail av misstag? Ignorera det bara.
              </p>
              <p style="color: #333333; font-size: 16px; margin: 0; font-weight: bold;">
                Med vänliga hälsningar,<br>
                Parium-teamet
              </p>
              
              <p style="color: #999999; font-size: 12px; margin: 20px 0 0 0;">
                Parium - AI-driven rekrytering för framtidens arbetsmarknad
              </p>
            </div>
            
          </div>
          
        </body>
        </html>
      `;
    } else {
      subject = "Återställ ditt lösenord - Parium";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          
          <!-- Simple container -->
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            
            <!-- Header -->
            <div style="background-color: #3b82f6; padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Återställ ditt lösenord</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">Parium</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="color: #333333; margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">
                Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto.<br>
                Klicka på knappen nedan för att skapa ett nytt lösenord.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" 
                   style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-size: 16px; font-weight: bold;">
                  🔐 Återställ lösenord
                </a>
              </div>
              
              <!-- Security notice -->
              <div style="background-color: #dbeafe; border: 1px solid #3b82f6; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="color: #1d4ed8; font-size: 14px; margin: 0; text-align: center; font-weight: bold;">
                  ⚠️ Säkerhetsnotis
                </p>
                <p style="color: #1d4ed8; font-size: 14px; margin: 5px 0 0 0; text-align: center;">
                  Denna länk är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.
                </p>
              </div>
              
              <!-- Alternative link -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
                <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                  Fungerar inte knappen? Kopiera länken nedan:
                </p>
                <p style="color: #0066cc; font-size: 14px; word-break: break-all; margin: 0;">
                  ${confirmationUrl}
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                Fick du detta mail av misstag? Ignorera det bara.
              </p>
              <p style="color: #333333; font-size: 16px; margin: 0; font-weight: bold;">
                Med vänliga hälsningar,<br>
                Parium-teamet
              </p>
              
              <p style="color: #999999; font-size: 12px; margin: 20px 0 0 0;">
                Parium - AI-driven rekrytering för framtidens arbetsmarknad
              </p>
            </div>
            
          </div>
          
        </body>
        </html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Parium Team <onboarding@resend.dev>",
      to: [email],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-confirmation-email function:", error);
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