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
      </head>
      <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        
        <!-- Simple container -->
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          
          <!-- Header -->
          <div style="background-color: #6366f1; padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Välkommen till Parium!</h1>
            <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">🚀 Din karriärresa börjar här</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px; text-align: center;">
              Bekräfta din e-postadress
            </h2>
            
            <p style="color: #666666; margin: 0 0 30px 0; font-size: 16px; line-height: 1.5; text-align: center;">
              Tack för att du valde Parium som din partner för framtidens karriär. Ett klick kvar till att upptäcka ditt drömjobb.
            </p>
            
            <!-- Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${testConfirmationUrl}" 
                 style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 5px; font-size: 16px; font-weight: bold;">
                ✓ Bekräfta e-postadress
              </a>
            </div>
            
            <!-- Alternative link -->
            <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
                Fungerar inte knappen? Kopiera länken nedan:
              </p>
              <p style="color: #0066cc; font-size: 14px; word-break: break-all; margin: 0;">
                ${testConfirmationUrl}
              </p>
            </div>
            
            <!-- Test notice -->
            <div style="background-color: #e3f2fd; border: 1px solid #2196f3; border-radius: 5px; padding: 15px; margin: 20px 0;">
              <p style="color: #1976d2; font-size: 14px; margin: 0; text-align: center; font-weight: bold;">
                📧 Detta är ett test-meddelande
              </p>
              <p style="color: #1976d2; font-size: 14px; margin: 5px 0 0 0; text-align: center;">
                Utvecklingssyfte - klicka inte på länken om du inte förväntar dig detta
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