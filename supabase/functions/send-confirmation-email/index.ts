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
          <title>Välkommen till Parium</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 16px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                Välkommen till Parium! 🎉
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 16px 0 0 0; font-size: 18px;">
                Din framtid väntar på dig
              </p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">
                Bekräfta din e-postadress
              </h2>
              
              <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">
                Tack för att du registrerat dig hos Parium! För att slutföra din registrering och börja din resa mot den perfekta jobbet, behöver du bekräfta din e-postadress.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; transition: transform 0.2s;">
                  Bekräfta e-postadress
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0; line-height: 1.5;">
                Om knappen inte fungerar kan du kopiera och klistra in denna länk i din webbläsare:
              </p>
              <p style="color: #3b82f6; font-size: 14px; word-break: break-all; margin: 10px 0;">
                ${confirmationUrl}
              </p>
            </div>
            
            <div style="text-align: center; color: #64748b; font-size: 14px;">
              <p style="margin: 0;">
                Om du inte registrerade dig hos Parium kan du ignorera detta meddelande.
              </p>
              <p style="margin: 10px 0 0 0;">
                Med vänliga hälsningar,<br>
                <strong style="color: #1e293b;">Parium-teamet</strong>
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
          <title>Återställ lösenord - Parium</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 16px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                Återställ ditt lösenord 🔐
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 16px 0 0 0; font-size: 18px;">
                Parium
              </p>
            </div>
            
            <div style="background: white; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">
                Begäran om lösenordsåterställning
              </h2>
              
              <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">
                Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto. Klicka på knappen nedan för att skapa ett nytt lösenord.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Återställ lösenord
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0; line-height: 1.5;">
                Om knappen inte fungerar kan du kopiera och klistra in denna länk i din webbläsare:
              </p>
              <p style="color: #3b82f6; font-size: 14px; word-break: break-all; margin: 10px 0;">
                ${confirmationUrl}
              </p>
              
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 30px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 600;">
                  ⚠️ Säkerhetsnotis
                </p>
                <p style="color: #92400e; font-size: 14px; margin: 8px 0 0 0;">
                  Denna länk är giltig i 1 timme. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.
                </p>
              </div>
            </div>
            
            <div style="text-align: center; color: #64748b; font-size: 14px;">
              <p style="margin: 0;">
                Med vänliga hälsningar,<br>
                <strong style="color: #1e293b;">Parium-teamet</strong>
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
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