import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log(`Sending test email to: ${email}`);

    const testConfirmationUrl = "https://rvtsfnaqlnggfkoqygbm.lovable.app/auth?test=true";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Välkommen till Parium</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
                
                <!-- Header with Parium branding -->
                <tr>
                  <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); padding: 50px 40px; text-align: center; border-radius: 16px 16px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                      Välkommen till Parium
                    </h1>
                    <p style="color: rgba(255,255,255,0.95); margin: 12px 0 0 0; font-size: 20px; font-weight: 300;">
                      🚀 Din karriärresa börjar här
                    </p>
                  </td>
                </tr>
                
                <!-- Main content -->
                <tr>
                  <td style="background: #ffffff; padding: 50px 40px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
                    <h2 style="color: #111827; margin: 0 0 24px 0; font-size: 28px; font-weight: 600; text-align: center;">
                      Bekräfta din e-postadress
                    </h2>
                    
                    <p style="color: #4b5563; margin: 0 0 32px 0; font-size: 18px; text-align: center; line-height: 1.7;">
                      Tack för att du valde Parium som din partner för framtidens karriär. Ett klick kvar till att upptäcka ditt drömjobb.
                    </p>
                    
                    <!-- CTA Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="text-align: center; padding: 20px 0;">
                          <a href="${testConfirmationUrl}" 
                             style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-weight: 600; font-size: 18px; box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.35); transition: all 0.2s;">
                            ✓ Bekräfta e-postadress
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Alternative link -->
                    <div style="margin: 40px 0; padding: 24px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0; font-weight: 500;">
                        Fungerar inte knappen? Kopiera länken nedan:
                      </p>
                      <p style="color: #3b82f6; font-size: 14px; word-break: break-all; margin: 0; font-family: 'SF Mono', Consolas, monospace; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #ddd6fe;">
                        ${testConfirmationUrl}
                      </p>
                    </div>
                    
                    <!-- Test notice -->
                    <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 32px 0;">
                      <p style="color: #1e40af; font-size: 16px; margin: 0; font-weight: 600; text-align: center;">
                        📧 Detta är ett test-meddelande
                      </p>
                      <p style="color: #1e40af; font-size: 14px; margin: 8px 0 0 0; text-align: center;">
                        Utvecklingssyfte - klicka inte på länken om du inte förväntar dig detta
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: #ffffff; padding: 40px; text-align: center; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px; margin: 0 0 12px 0;">
                      Fick du detta mail av misstag? Ignorera det bara.
                    </p>
                    <p style="color: #111827; font-size: 16px; margin: 0; font-weight: 600;">
                      Med vänliga hälsningar,<br>
                      <span style="background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; color: #6366f1;">Parium-teamet</span>
                    </p>
                    
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        Parium - AI-driven rekrytering för framtidens arbetsmarknad
                      </p>
                    </div>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Parium Team <onboarding@resend.dev>",
      to: [email],
      subject: "✨ TEST: Välkommen till Parium - Din framtids karriärpartner",
      html: htmlContent,
    });

    console.log("Test email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Test email sent to ${email}`,
      id: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in test-email function:", error);
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