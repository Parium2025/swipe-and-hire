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
    // This is a webhook from Supabase Auth
    const body = await req.text();
    const data = JSON.parse(body);
    
    const { user, reset_password_url } = data;
    
    if (!user?.email || !reset_password_url) {
      throw new Error("Missing required data");
    }

    const emailResponse = await resend.emails.send({
      from: "Parium <onboarding@resend.dev>",
      to: [user.email],
      subject: "Återställ ditt lösenord - Parium",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; margin-bottom: 24px;">Återställ ditt lösenord</h1>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 24px;">
            Hej! Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto.
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${reset_password_url}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;
                      font-weight: 500;">
              Återställ lösenord
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 16px;">
            Om knappen inte fungerar kan du kopiera och klistra in denna länk i din webbläsare:
          </p>
          
          <p style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; 
                    word-break: break-all; font-size: 14px; margin-bottom: 24px;">
            ${reset_password_url}
          </p>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            Om du inte begärde denna återställning kan du ignorera detta mail. 
            Länken kommer att upphöra att gälla inom 24 timmar.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Detta mail kommer från Parium - din plattform för jobbmatchning
          </p>
        </div>
      `,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
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