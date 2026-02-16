import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { Resend } from "npm:resend@2.0.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ResetPasswordRequest {
  email: string;
}

const getResetTemplate = (resetUrl: string) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Återställ ditt lösenord – Parium</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Arial, Helvetica, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; max-width: 600px;">
          <tr>
            <td style="background-color: #1E3A8A; padding: 32px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0 0 4px 0; font-size: 24px; font-weight: bold; color: #ffffff;">Parium</h1>
              <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.8);">Återställ ditt lösenord</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
                Klicka på knappen nedan för att skapa ett nytt lösenord.
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 15px; font-weight: bold; line-height: 46px; text-align: center; text-decoration: none; width: 240px; -webkit-text-size-adjust: none;">Återställ lösenord</a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #F0F9FF; border-left: 4px solid #1E3A8A; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px; color: #1E3A8A; font-weight: 600;">Säkerhetsnotis</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #6B7280;">
                  Denna länk är tidsbegränsad. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.
                </p>
              </div>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                <tr>
                  <td style="background-color: #F9FAFB; padding: 20px; border-radius: 8px;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #6B7280;">Fungerar inte knappen? Kopiera länken nedan:</p>
                    <p style="margin: 0; font-size: 12px; color: #1E3A8A; word-break: break-all;">${resetUrl}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 30px; text-align: center; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 13px; color: #9CA3AF;">Parium AB · Stockholm<br/>Du får detta mail för att du begärde en lösenordsåterställning i Parium-appen.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ResetPasswordRequest = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email krävs" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Sending password reset email to: ${email}`);

    let resetUrl = null;
    
    try {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email,
      });

      if (!error && data.properties) {
        console.log('🔍 generateLink properties:', data.properties);

        if (data.properties.action_link) {
          resetUrl = data.properties.action_link;
          console.log(`✅ USING SUPABASE ACTION LINK: ${resetUrl}`);
        } else {
          console.error('❌ No action_link found in Supabase response');
        }
      }
    } catch (linkError) {
      console.log('Password reset attempted for:', email.substring(0, 3) + '***');
    }

    if (resetUrl) {
      console.log('✅ Sending reset email for valid user');
      
      const emailResponse = await resend.emails.send({
        from: "Parium <noreply@parium.se>",
        to: [email],
        subject: "Återställ ditt lösenord – Parium",
        text: `Hej!\n\nVi har fått en begäran om att återställa lösenordet för ditt Parium-konto.\n\nKlicka på länken nedan för att skapa ett nytt lösenord:\n${resetUrl}\n\nDenna länk är tidsbegränsad. Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande.\n\nParium AB · Stockholm`,
        html: getResetTemplate(resetUrl),
      });
      
      console.log("Password reset email sent successfully:", emailResponse?.data?.id);
    } else {
      console.log("Password reset attempted for non-existent user");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "If an account with that email exists, you will receive a password reset link shortly."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-reset-password:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);