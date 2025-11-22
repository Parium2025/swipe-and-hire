import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  email: string;
  role: 'job_seeker' | 'employer';
  first_name: string;
  confirmation_url: string;
  company_name?: string;
}

const getJobSeekerTemplate = (firstName: string, confirmationUrl: string) => `
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
                 Hej ${firstName}!
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

const getEmployerTemplate = (firstName: string, confirmationUrl: string, companyName: string = 'ert företag') => `
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
                Hej ${firstName}!
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                Välkommen till Parium - plattformen där <strong>${companyName}</strong> möter framtida talanger. Vi hjälper er att rekrytera snabbare, mer effektivt och utan krångel.
              </p>
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 10px auto 30px auto; max-width: 450px;">
                <tr>
                  <td style="vertical-align: top; padding-right: 8px; color: #111827; font-size: 16px; line-height: 24px;">•</td>
                  <td style="color: #111827; font-size: 16px; line-height: 24px; padding-bottom: 12px; text-align: left;">En smidig rekryteringsprocess från start till mål</td>
                </tr>
                <tr>
                  <td style="vertical-align: top; padding-right: 8px; color: #111827; font-size: 16px; line-height: 24px;">•</td>
                  <td style="color: #111827; font-size: 16px; line-height: 24px; padding-bottom: 12px; text-align: left;">Direktkontakt med kandidater</td>
                </tr>
                <tr>
                  <td style="vertical-align: top; padding-right: 8px; color: #111827; font-size: 16px; line-height: 24px;">•</td>
                  <td style="color: #111827; font-size: 16px; line-height: 24px; text-align: left;">Ett modernt gränssnitt anpassat för era krav</td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #111827; line-height: 24px; text-align: center;">
                      Bekräfta ditt konto för att komma igång direkt.
                    </p>
                    <a href="${confirmationUrl}" style="background-color: #1E3A8A; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; line-height: 48px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none;">
                      Bekräfta företagskonto
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0 0; font-size: 16px; color: #111827; text-align: center; line-height: 24px;">
                Tack för att du väljer Parium för er rekrytering.<br>
                Tillsammans skapar vi framtidens arbetsliv!
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
`;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, first_name, confirmation_url, company_name }: ConfirmationEmailRequest = await req.json();

    console.log(`Sending confirmation email to ${email} with role ${role}`);

    // Choose the correct template based on role
    const emailHtml = role === 'employer' 
      ? getEmployerTemplate(first_name, confirmation_url, company_name || 'ert företag')
      : getJobSeekerTemplate(first_name, confirmation_url);

    const subject = role === 'employer' 
      ? 'Välkommen till Parium – Bekräfta ditt företagskonto'
      : 'Bekräfta ditt konto – Parium';

    const emailResponse = await resend.emails.send({
      from: "Parium <noreply@parium.se>",
      to: [email],
      subject: subject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
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
    );  }
};

serve(handler);
