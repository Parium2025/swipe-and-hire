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

interface ResendRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ResendRequest = await req.json();

    console.log(`Resending confirmation for email: ${email}`);

    // 1. Hitta användaren i auth.users
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const user = listData.users.find(u => u.email === email);
    
    if (!user) {
      return new Response(JSON.stringify({ 
        error: "Ingen användare hittad med denna e-postadress. Registrera dig först." 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // 2. Kontrollera om användaren redan är bekräftad
    if (user.email_confirmed_at) {
      return new Response(JSON.stringify({ 
        error: "E-posten är redan bekräftad. Du kan logga in direkt." 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log(`Found unconfirmed user: ${user.id}`);

    // 3. Skapa ny bekräftelsetoken
    const newToken = crypto.randomUUID();
    
    // 4. Uppdatera eller skapa ny bekräftelsepost
    const { error: upsertError } = await supabase
      .from('email_confirmations')
      .upsert({
        user_id: user.id,
        email: email,
        token: newToken,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minuter
        confirmed_at: null
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error updating confirmation:', upsertError);
      throw upsertError;
    }

    const confirmationUrl = `https://rvtsfnaqlnggfkoqygbm.supabase.co/functions/v1/redirect-confirm?token=${newToken}`;

    // Fetch profile to personalize and detect role
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('first_name, role, company_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('Could not fetch profile for resend:', profileErr.message);
    }

    const firstName = (profile?.first_name || '').trim();
    const greet = firstName ? `Hej ${firstName}!` : 'Hej!';
    const isEmployer = (profile?.role || '').toLowerCase() === 'employer';
    const companyName = profile?.company_name || 'ert företag';

    const subject = isEmployer
      ? 'Välkommen till Parium – Bekräfta ditt företagskonto'
      : 'Bekräfta ditt konto – Parium';

    // Build HTML identical to first email templates (button BELOW bullet list)
    const html = isEmployer ? `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Välkommen till Parium – Bekräfta ditt företagskonto</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Arial, Helvetica, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; max-width: 600px;">
          <tr>
            <td style="background-color: #1E3A8A; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: bold; color: #ffffff;">Parium</h1>
              <p style="margin: 0; font-size: 16px; color: #ffffff;">Hitta nästa generations talanger</p>
            </td>
          </tr>
           <tr>
             <td align="left" style="padding: 40px 30px; text-align: left;">
               <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                 ${greet}
               </p>
               <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827; text-align: left; line-height: 24px;">
                  Välkommen till Parium - plattformen där <strong>${companyName}</strong> hittar nästa generations talang/talanger. Vi hjälper er att rekrytera enklare, snabbare och träffsäkrare.
                </p>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                  <tr>
                    <td style="font-size: 16px; color: #111827; text-align: left;">
                       <p style="margin: 0 0 12px 0; text-align: left;">• En smidig rekryteringsprocess från start till mål</p>
                       <p style="margin: 0 0 12px 0; text-align: left;">• Direktkontakt med kandidater</p>
                       <p style="margin: 0; text-align: left;">• Ett modernt gränssnitt anpassat för era krav</p>
                  </td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${confirmationUrl}" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none;">
                      Bekräfta företagskonto
                    </a>
                  </td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                <tr>
                  <td style="background-color: #F9FAFB; padding: 20px; border-radius: 8px;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #6B7280; text-align: center;">Fungerar inte knappen? Kopiera länken nedan:</p>
                    <p style="margin: 0; font-size: 12px; color: #1E3A8A; word-break: break-all; text-align: center;">${confirmationUrl}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 30px; text-align: center; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 14px; color: #6B7280;">Parium AB · Stockholm<br/>Du får detta mail för att du registrerat ett företagskonto i Parium.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
` : `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bekräfta ditt konto – Parium</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Arial, Helvetica, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; max-width: 600px;">
          <tr>
            <td style="background-color: #1E3A8A; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: bold; color: #ffffff;">Parium</h1>
              <p style="margin: 0; font-size: 16px; color: #ffffff;">Framtiden börjar med ett swipe</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
               <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                 ${greet}
               </p>
               <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827; text-align: left; line-height: 24px;">
                 Du har just klivit in i nästa generation av jobbsök. Med Parium swipar du dig fram till möjligheter som faktiskt kan förändra din vardag.
               </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                 <tr>
                   <td style="font-size: 16px; color: #111827; text-align: left;">
                     <p style="margin: 0 0 12px 0; text-align: left;">• Matcha med jobb som passar dig</p>
                     <p style="margin: 0 0 12px 0; text-align: left;">• Swipea, ansök och gå vidare på sekunder</p>
                     <p style="margin: 0; text-align: left;">• Spara tid med smarta och effektiva verktyg</p>
                  </td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${confirmationUrl}" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none;">Bekräfta mitt konto</a>
                  </td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                <tr>
                  <td style="background-color: #F9FAFB; padding: 20px; border-radius: 8px;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #6B7280; text-align: center;">Fungerar inte knappen? Kopiera länken nedan:</p>
                    <p style="margin: 0; font-size: 12px; color: #1E3A8A; word-break: break-all; text-align: center;">${confirmationUrl}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 30px; text-align: center; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 14px; color: #6B7280;">Parium AB · Stockholm<br/>Du får detta mail för att du registrerat ett konto i Parium-appen.</p>
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
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject,
      html,
    });

    console.log("Resend confirmation email sent:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Ny bekräftelselänk skickad! Kolla din e-post.",
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in resend-confirmation:", error);
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