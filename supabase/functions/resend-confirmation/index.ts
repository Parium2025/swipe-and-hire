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
      console.log('User already confirmed, sending welcome email instead of confirmation link');

      // Fetch profile to personalize email
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('first_name, role, company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('Could not fetch profile for confirmed user in resend:', profileErr.message);
      }

      const firstName = (profile?.first_name || '').trim() || 'där';
      const isEmployer = (profile?.role || '').toLowerCase() === 'employer';
      const companyName = profile?.company_name || 'Ditt företag';

      const appUrl = Deno.env.get("REDIRECT_URL") || "https://swipe-and-hire.lovable.app";
      const loginUrl = `${appUrl}/auth`;

      const subject = isEmployer
        ? 'Välkommen till Parium – Ditt företagskonto är aktivt'
        : 'Välkommen till Parium – Ditt konto är aktivt';

      const html = isEmployer
        ? `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Välkommen till Parium – Ditt företagskonto är aktivt</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Arial, Helvetica, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; max-width: 600px;">
                  <tr>
                    <td style="background-color: #1E3A8A; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: bold; color: #ffffff;">Parium</h1>
                       <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #ffffff;">Hitta nästa generations talang/talanger</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">Hej ${firstName}!</p>
                      <p style="margin: 0 0 30px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                         Välkommen till Parium – plattformen där <strong>${companyName}</strong> hittar nästa generations talang/talanger. Ditt konto är nu aktivt och du kan logga in direkt!
                       </p>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
                        <tr>
                          <td style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: center;">
                             <p style="margin: 0 0 12px 0; text-align: center;">• En smidig rekryteringsprocess från start till mål</p>
                             <p style="margin: 0 0 12px 0; text-align: center;">• Direktkontakt med kandidater</p>
                             <p style="margin: 0 0 30px 0; text-align: center;">• Ett modernt gränssnitt anpassat för era krav</p>
                          </td>
                        </tr>
                      </table>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                        <tr>
                          <td align="center" style="padding: 0;">
                            <!--[if mso]>
                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="21%" stroke="f" fillcolor="#1E3A8A">
                            <w:anchorlock/>
                            <center>
                            <![endif]-->
                            <a href="${loginUrl}" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none; mso-hide: all;">Logga in nu</a>
                            <!--[if mso]>
                            </center>
                            </v:roundrect>
                            <![endif]-->
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #F9FAFB; padding: 24px 30px; text-align: center; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
                       <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6B7280;">Parium AB · Stockholm<br/>Du får detta mail för att du registrerat ett företagskonto i Parium-appen.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        `
        : `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Välkommen till Parium – Ditt konto är aktivt</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: Arial, Helvetica, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; max-width: 600px;">
                  <tr>
                    <td style="background-color: #1E3A8A; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: bold; color: #ffffff;">Parium</h1>
                      <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #ffffff;">Framtiden börjar med ett swipe</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">Hej ${firstName}!</p>
                      <p style="margin: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                        Välkommen till Parium — nästa steg i ett smartare jobbsökande.<br>
                        Genom vår plattform får du tillgång till moderna verktyg som effektiviserar varje steg i din process.
                      </p>
                      <p style="margin: 0 0 12px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: center; line-height: 24px; font-weight: bold;">
                        Med Parium kan du:
                      </p>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 12px;">
                        <tr>
                           <td style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #111827; text-align: left;">
                             <p style="margin: 0 0 12px 0; text-align: left;">• Hitta jobb som verkligen matchar din profil</p>
                             <p style="margin: 0 0 12px 0; text-align: left;">• Swipea dig igenom alternativ och ansöka på några sekunder</p>
                             <p style="margin: 0; text-align: left;">• Spara tid med verktyg som gör processen både enkel och effektiv</p>
                          </td>
                        </tr>
                      </table>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                        <tr>
                          <td align="center" style="padding: 0;">
                            <!--[if mso]>
                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="21%" stroke="f" fillcolor="#1E3A8A">
                            <w:anchorlock/>
                            <center>
                            <![endif]-->
                            <a href="${loginUrl}" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none; mso-hide: all;">Logga in nu</a>
                            <!--[if mso]>
                            </center>
                            </v:roundrect>
                            <![endif]-->
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #F9FAFB; padding: 24px 30px; text-align: center; border-top: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
                      <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6B7280;">Parium AB · Stockholm<br/>Du får detta mail för att du registrerat ett konto i Parium-appen.</p>
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

      console.log('Welcome email re-sent for confirmed user:', emailResponse);

      return new Response(JSON.stringify({
        success: true,
        message: "Ditt konto är redan aktivt. Vi har skickat ett välkomstmail med inloggningsknapp igen.",
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log(`Found unconfirmed user: ${user.id}`);

    // 3. Skapa ny bekräftelsetoken
    const newToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 timmar
    
    // 4. Uppdatera eller skapa ny bekräftelsepost (utan e-post-kolumn, följer nuvarande schema)
    const { error: upsertError } = await supabase
      .from('email_confirmations')
      .upsert(
        {
          user_id: user.id,
          token: newToken,
          expires_at: expiresAt,
          confirmed_at: null,
        },
        {
          onConflict: 'user_id',
        },
      );

    if (upsertError) {
      console.error('Error updating confirmation:', upsertError);
      throw upsertError;
    }

    // 5. Bygg bekräftelse-URL direkt mot frontend-appens email-confirm-sida
    const redirectEnv = Deno.env.get("REDIRECT_URL") || "";
    const defaultAppUrl = "https://parium.se";

    let appBase = defaultAppUrl;
    if (redirectEnv && redirectEnv.startsWith("http")) {
      appBase = redirectEnv.includes("supabase.co") ? defaultAppUrl : redirectEnv;
    }

    const confirmationUrl = `${appBase}/email-confirm?confirm=${newToken}`;

    console.log(`Resend confirmation URL for ${email}: ${confirmationUrl}`);

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
              <p style="margin: 0; font-size: 16px; color: #ffffff;">Hitta nästa generations talang/talanger</p>
            </td>
          </tr>
           <tr>
             <td style="padding: 40px 30px;">
               <p style="margin: 0 0 24px 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                 ${greet}
               </p>
               <p style="margin: 0 0 30px 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                  Välkommen till Parium - plattformen där <strong>${companyName}</strong> hittar nästa generations talang/talanger. Vi hjälper er att rekrytera enklare, snabbare och träffsäkrare.
                </p>
                <div style="margin: 30px auto; max-width: 450px; text-align: center;">
                  <p style="margin: 0 0 12px 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">• En smidig rekryteringsprocess från start till mål</p>
                  <p style="margin: 0 0 12px 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">• Direktkontakt med kandidater</p>
                  <p style="margin: 0 0 30px 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">• Ett modernt gränssnitt anpassat för era krav</p>
                </div>
              <p style="margin: 20px 0 10px 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                Bekräfta ditt konto för att komma igång direkt.
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${confirmationUrl}" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none;">
                      Bekräfta företagskonto
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                Tack för att du väljer Parium för er rekrytering.<br>
                Tillsammans skapar vi framtidens arbetsliv.
              </p>
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
              <p style="margin: 0; font-size: 14px; color: #6B7280;">Parium AB · Stockholm<br/>Du får detta mail för att du registrerat ett företagskonto i Parium-appen.</p>
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
               <p style="margin: 0 0 24px 0; font-size: 16px; color: #333333; text-align: center; line-height: 1.6;">
                 ${greet}
               </p>
               <p style="margin: 0 0 24px 0; font-size: 16px; color: #333333; text-align: center; line-height: 1.6;">
                 Välkommen till Parium — nästa steg i ett smartare jobbsökande.<br>
                 Genom vår plattform får du tillgång till moderna verktyg som effektiviserar varje steg i din process.
               </p>
               <p style="margin: 0 0 12px 0; font-size: 16px; color: #333333; text-align: center; line-height: 1.6; font-weight: bold;">
                 Med Parium kan du:
               </p>
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 10px auto 30px auto; max-width: 450px;">
                <tr>
                  <td style="vertical-align: top; padding-right: 8px; color: #333333; font-size: 16px; line-height: 1.6;">•</td>
                  <td style="color: #333333; font-size: 16px; line-height: 1.6; padding-bottom: 12px;">Hitta jobb som verkligen matchar din profil</td>
                </tr>
                <tr>
                  <td style="vertical-align: top; padding-right: 8px; color: #333333; font-size: 16px; line-height: 1.6;">•</td>
                  <td style="color: #333333; font-size: 16px; line-height: 1.6; padding-bottom: 12px;">Swipea dig igenom alternativ och ansöka på några sekunder</td>
                </tr>
                <tr>
                  <td style="vertical-align: top; padding-right: 8px; color: #333333; font-size: 16px; line-height: 1.6;">•</td>
                  <td style="color: #333333; font-size: 16px; line-height: 1.6;">Spara tid med verktyg som gör processen både enkel och effektiv</td>
                </tr>
              </table>
              <p style="margin: 20px 0 10px 0; font-size: 16px; color: #333333; text-align: center; line-height: 1.6;">
                Bekräfta ditt konto för att komma igång!
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${confirmationUrl}" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none;">Bekräfta mitt konto</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0 0; font-size: 16px; color: #333333; text-align: center; line-height: 1.6;">
                Tack för ditt förtroende.<br>
                Det här kan bli början på något riktigt bra!
              </p>
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